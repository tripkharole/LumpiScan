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
BASE_DIR    = os.path.dirname(os.path.abspath(__file__)) 
MODEL_PATH = os.path.join(BASE_DIR, "model", "lsd_model.keras")
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
    Query params: lat, lon, radius_km (default 50)
    Returns list of nearby veterinarians sorted by distance
    """
    try:
        user_lat = float(request.args.get("lat", 0))
        user_lon = float(request.args.get("lon", 0))
        radius   = float(request.args.get("radius_km", 50))
    except ValueError:
        return jsonify({"error": "Invalid coordinates"}), 400

    db = load_db()
    nearby = []
    for vet in db["vets"]:
        try:
            dist = haversine(user_lat, user_lon, vet["lat"], vet["lon"])
            if dist <= radius:
                nearby.append({**vet, "distance_km": round(dist, 1)})
        except Exception:
            pass

    nearby.sort(key=lambda v: v["distance_km"])
    return jsonify({"vets": nearby, "total": len(nearby)})


@app.route("/register-user", methods=["POST"])
def register_user():
    """Register a cattle owner."""
    data = request.json or {}
    required = ["phone", "location"]
    for field in required:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400

    db = load_db()
    # Check duplicate
    if any(u["phone"] == data["phone"] for u in db["users"]):
        return jsonify({"error": "Phone already registered"}), 409

    user = {
        "id": str(uuid.uuid4()),
        "phone": data["phone"],
        "location": data["location"],
        "name": data.get("name", ""),
        "created_at": datetime.utcnow().isoformat()
    }
    db["users"].append(user)
    save_db(db)
    return jsonify({"message": "User registered", "user_id": user["id"]}), 201


@app.route("/register-vet", methods=["POST"])
def register_vet():
    """Register a veterinary doctor."""
    data = request.json or {}
    required = ["name", "phone", "specialization", "clinic_address", "lat", "lon"]
    for field in required:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400

    db = load_db()
    vet = {
        "id": str(uuid.uuid4()),
        "name": data["name"],
        "phone": data["phone"],
        "specialization": data["specialization"],
        "clinic_address": data["clinic_address"],
        "lat": float(data["lat"]),
        "lon": float(data["lon"]),
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