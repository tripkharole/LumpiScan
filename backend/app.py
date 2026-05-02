"""
CattleCare AI - Flask Backend
Endpoints:
  POST /predict           - Predict LSD from uploaded image
  GET  /search-doctors    - Find nearby vets by location
  POST /register-user     - Register cattle owner
  POST /register-vet      - Register veterinarian
  GET  /history/<user_id> - Get prediction history
"""

import os
import uuid
import json
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from PIL import Image
import io
import math

app = Flask(__name__)
CORS(app)  # Allow React frontend on different port

# ─── CONFIG ───────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))         # .../backend/
MODEL_PATH  = os.path.join(BASE_DIR, "model", "lsd_model.h5")   # backend/model/lsd_model.h5
UPLOAD_DIR  = os.path.join(BASE_DIR, "uploads")
DB_FILE     = os.path.join(BASE_DIR, "database.json")
IMG_SIZE    = 224
CLASS_NAMES = ["Healthy", "Lumpy Skin Disease"]
# ──────────────────────────────────────────────────────────────────────────────

os.makedirs(UPLOAD_DIR, exist_ok=True)


# ─── SIMPLE JSON DATABASE HELPERS ─────────────────────────────────────────────
def load_db():
    if os.path.exists(DB_FILE):
        with open(DB_FILE) as f:
            return json.load(f)
    return {"users": [], "vets": [], "predictions": []}

def save_db(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=2)
# ──────────────────────────────────────────────────────────────────────────────


# ─── LOAD MODEL AT STARTUP ────────────────────────────────────────────────────
model       = None
model_error = None

def load_model_once():
    global model, model_error
    resolved = os.path.abspath(MODEL_PATH)
    print(f"[MODEL] Resolved path : {resolved}")
    print(f"[MODEL] File exists   : {os.path.exists(resolved)}")
    if not os.path.exists(resolved):
        model_error = f"Model file not found: {resolved}"
        print(f"[MODEL] WARNING  {model_error}")
        return
    try:
        # compile=False avoids optimizer deserialization issues across TF versions
        model = load_model(resolved, compile=False)
        model.compile(optimizer="adam", loss="categorical_crossentropy", metrics=["accuracy"])
        print("[MODEL] Loaded successfully")
    except Exception as exc:
        model_error = str(exc)
        print(f"[MODEL] ERROR Failed to load - {model_error}")
        # Fallback: try legacy Keras loader
        try:
            import keras
            model = keras.models.load_model(resolved, compile=False)
            print("[MODEL] Loaded via legacy Keras fallback")
            model_error = None
        except Exception as exc2:
            model_error = f"Both loaders failed. Primary: {exc} | Fallback: {exc2}"
            print(f"[MODEL] ERROR Fallback also failed - {exc2}")

load_model_once()   # runs once at import / startup
# ──────────────────────────────────────────────────────────────────────────────


def preprocess_image(image_bytes):
    """Preprocess image bytes for MobileNetV2 inference."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((IMG_SIZE, IMG_SIZE))
    arr = np.array(img, dtype=np.float32)
    arr = preprocess_input(arr)
    return np.expand_dims(arr, axis=0)


def haversine(lat1, lon1, lat2, lon2):
    """Calculate distance (km) between two GPS coordinates."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ─── ROUTES ───────────────────────────────────────────────────────────────────

@app.route("/", methods=["GET"])
def health():
    return jsonify({
        "status": "CattleCare API running",
        "model_loaded": model is not None,
        "model_path": os.path.abspath(MODEL_PATH),
        "model_error": model_error,
    })


@app.route("/predict", methods=["POST"])
def predict():
    """
    Accepts: multipart/form-data with 'image' file + optional 'user_id'
    Returns: { prediction, confidence, label, recommendations, saved_path }
    """
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files["image"]
    user_id = request.form.get("user_id", "anonymous")

    # Read and save image
    img_bytes = file.read()
    filename = f"{uuid.uuid4().hex}.jpg"
    save_path = os.path.join(UPLOAD_DIR, filename)
    with open(save_path, "wb") as f:
        f.write(img_bytes)

    # Inference
    if model is None:
        # Demo mode: return mock result if model not trained yet
        prediction_idx = 1
        confidence = 0.94
    else:
        processed = preprocess_image(img_bytes)
        preds = model.predict(processed)[0]
        prediction_idx = int(np.argmax(preds))
        confidence = float(np.max(preds))

    label = CLASS_NAMES[prediction_idx]
    is_infected = prediction_idx == 1

    recommendations = []
    if is_infected:
        recommendations = [
            "Immediately isolate the animal from the herd.",
            "Contact a registered veterinarian as soon as possible.",
            "Administer prescribed anti-inflammatory medication.",
            "Apply insect/vector control measures in the barn.",
            "Report to local livestock disease authority."
        ]
    else:
        recommendations = [
            "Animal appears healthy. Continue regular monitoring.",
            "Maintain vaccination schedule.",
            "Ensure clean water and proper nutrition."
        ]

    # Save prediction to database
    db = load_db()
    record = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "filename": filename,
        "label": label,
        "confidence": round(confidence * 100, 2),
        "is_infected": is_infected,
        "timestamp": datetime.utcnow().isoformat()
    }
    db["predictions"].append(record)
    save_db(db)

    return jsonify({
        "prediction": label,
        "confidence": round(confidence * 100, 2),
        "is_infected": is_infected,
        "recommendations": recommendations,
        "case_id": record["id"],
        "saved_image": filename
    })


@app.route("/search-doctors", methods=["GET"])
def search_doctors():
    """
    Query params:
      - location (text) : match vets whose clinic_address contains this string (case-insensitive)
      - lat, lon        : optional GPS coords for distance sorting
      - radius_km       : optional radius filter when lat/lon provided (default 50)
    Returns list of matching veterinarians sorted by distance (if coords given) or alphabetically.
    """
    location_text = (request.args.get("location", "") or "").strip().lower()
    lat_raw = request.args.get("lat")
    lon_raw = request.args.get("lon")
    radius  = float(request.args.get("radius_km", 9999))

    has_coords = lat_raw and lon_raw
    try:
        user_lat = float(lat_raw) if has_coords else None
        user_lon = float(lon_raw) if has_coords else None
    except ValueError:
        return jsonify({"error": "Invalid coordinates"}), 400

    db = load_db()
    results = []
    for vet in db["vets"]:
        address = (vet.get("clinic_address", "") or "").lower()
        name    = (vet.get("name", "") or "").lower()

        # Text match: location string is substring of address OR vet name
        text_match = (not location_text) or (location_text in address) or (location_text in name)
        if not text_match:
            continue

        # Distance filter (optional)
        dist = None
        if has_coords and vet.get("lat") and vet.get("lon"):
            try:
                dist = haversine(user_lat, user_lon, vet["lat"], vet["lon"])
                if dist > radius:
                    continue
            except Exception:
                pass

        results.append({
            **vet,
            "distance_km": round(dist, 1) if dist is not None else None
        })

    # Sort: by distance if available, else by name
    results.sort(key=lambda v: (v["distance_km"] is None, v["distance_km"] or 0, v.get("name", "")))
    return jsonify({"vets": results, "total": len(results)})


@app.route("/login-user", methods=["POST"])
def login_user():
    """Login existing cattle owner by phone number."""
    data = request.json or {}
    phone = data.get("phone", "").strip()
    if not phone:
        return jsonify({"error": "Phone number required"}), 400

    db = load_db()
    user = next((u for u in db["users"] if u["phone"] == phone), None)
    if not user:
        return jsonify({"error": "Phone not registered. Please register first."}), 404

    return jsonify({"message": "Login successful", "user_id": user["id"],
                    "name": user.get("name", ""), "location": user.get("location", ""),
                    "phone": user["phone"]}), 200


@app.route("/register-user", methods=["POST"])
def register_user():
    """Register a new cattle owner."""
    data = request.json or {}
    required = ["phone", "location"]
    for field in required:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400

    db = load_db()
    if any(u["phone"] == data["phone"] for u in db["users"]):
        return jsonify({"error": "Phone already registered. Please login instead."}), 409

    user = {
        "id": str(uuid.uuid4()),
        "phone": data["phone"],
        "location": data["location"],
        "name": data.get("name", ""),
        "created_at": datetime.utcnow().isoformat()
    }
    db["users"].append(user)
    save_db(db)
    return jsonify({"message": "Registered successfully", "user_id": user["id"],
                    "name": user["name"], "location": user["location"],
                    "phone": user["phone"]}), 201


@app.route("/register-vet", methods=["POST"])
def register_vet():
    """Register a veterinary doctor. lat/lon are optional."""
    data = request.json or {}
    required = ["name", "phone", "specialization", "clinic_address"]
    for field in required:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400

    db = load_db()
    if any(v["phone"] == data["phone"] for v in db["vets"]):
        return jsonify({"error": "Phone already registered as veterinarian."}), 409

    vet = {
        "id": str(uuid.uuid4()),
        "name": data["name"],
        "phone": data["phone"],
        "specialization": data["specialization"],
        "clinic_address": data["clinic_address"],
        "lat": float(data["lat"]) if data.get("lat") else None,
        "lon": float(data["lon"]) if data.get("lon") else None,
        "rating": 4.5,
        "reviews": 0,
        "created_at": datetime.utcnow().isoformat()
    }
    db["vets"].append(vet)
    save_db(db)
    return jsonify({"message": "Veterinarian registered", "vet_id": vet["id"]}), 201


@app.route("/history/<user_id>", methods=["GET"])
def get_history(user_id):
    """Get prediction history for a user."""
    db = load_db()
    history = [p for p in db["predictions"] if p["user_id"] == user_id]
    history.sort(key=lambda x: x["timestamp"], reverse=True)
    return jsonify({"history": history, "total": len(history)})


if __name__ == "__main__":
    # Model already loaded at startup via load_model_once()
    app.run(debug=True, port=5000)
