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
import sys
import uuid
import json
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import math

# predict.py is in the same backend/ folder — no path manipulation needed
try:
    from predict import get_predictor
    HAS_PREDICTOR = True
except ImportError as e:
    print(f"[WARN] Could not import predictor: {e}")
    HAS_PREDICTOR = False

app = Flask(__name__)
CORS(app)  # Allow React frontend on different port

# ─── CONFIG ───────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
DB_FILE    = os.path.join(BASE_DIR, "database.json")
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


# ─── LOAD PREDICTOR AT STARTUP ───────────────────────────────────────────────
_predictor    = None
_startup_error = None

def get_or_init_predictor():
    global _predictor, _startup_error
    if _predictor is not None:
        return _predictor
    if not HAS_PREDICTOR:
        _startup_error = "predict.py module not found"
        return None
    try:
        _predictor = get_predictor()
        return _predictor
    except Exception as e:
        _startup_error = str(e)
        print(f"[PREDICTOR] ERROR: {e}")
        return None

# Lazy loading — model loads on first request, not at startup
# This prevents Gunicorn worker timeout on Render free tier
# get_or_init_predictor()  ← disabled for Render deployment
# ──────────────────────────────────────────────────────────────────────────────





def haversine(lat1, lon1, lat2, lon2):
    """Calculate distance (km) between two GPS coordinates."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ─── ROUTES ───────────────────────────────────────────────────────────────────

@app.route("/debug-predict", methods=["POST"])
def debug_predict():
    """Debug endpoint — returns raw model output to identify label swap issues."""
    if "image" not in request.files:
        return jsonify({"error": "No image"}), 400
    if model is None:
        return jsonify({"error": "Model not loaded", "model_error": model_error}), 503

    img_bytes = request.files["image"].read()
    processed = preprocess_image(img_bytes)
    preds = model.predict(processed)[0]

    return jsonify({
        "raw_output": preds.tolist(),
        "class_0_score": float(preds[0]),
        "class_1_score": float(preds[1]),
        "current_class_names": CLASS_NAMES,
        "predicted_index": int(np.argmax(preds)),
        "predicted_label": CLASS_NAMES[int(np.argmax(preds))],
        "confidence": float(np.max(preds)),
        "hint": "If healthy images show high class_1_score, your CLASS_NAMES order is swapped. Swap index 0 and 1."
    })

@app.route("/", methods=["GET"])
def health():
    p = get_or_init_predictor()
    return jsonify({
        "status": "CattleCare API running",
        "lsd_model_loaded":  p is not None and p.lsd_model is not None,
        "cow_model_loaded":  p is not None and p.cow_model is not None,
        "lsd_threshold":     p.lsd_threshold if p else None,
        "cow_threshold":     p.cow_threshold if p else None,
        "lsd_class_mapping": p.lsd_map if p else None,
        "cow_class_mapping": p.cow_map if p else None,
        "startup_error":     _startup_error,
    })


@app.route("/predict", methods=["POST"])
def predict():
    """
    Two-stage prediction:
      Stage 1 — cow_or_not model: validates image is a cow
      Stage 2 — lsd model: healthy vs lumpy
    """
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file    = request.files["image"]
    user_id = request.form.get("user_id", "anonymous")

    # Save uploaded image
    img_bytes = file.read()
    filename  = f"{uuid.uuid4().hex}.jpg"
    save_path = os.path.join(UPLOAD_DIR, filename)
    with open(save_path, "wb") as fh:
        fh.write(img_bytes)

    # Get predictor
    p = get_or_init_predictor()
    if p is None:
        return jsonify({
            "error": "Predictor not loaded. Check server logs.",
            "startup_error": _startup_error
        }), 503

    # Run two-stage prediction
    import io as _io
    result = p.predict(_io.BytesIO(img_bytes))

    # Not a cow image
    if not result.get("is_cow", True):
        return jsonify({
            "error": "not_a_cow",
            "message": "Please upload a valid cow image.",
            "cow_confidence": result.get("cow_confidence")
        }), 400

    if "error" in result and result["error"] != "not_a_cow":
        return jsonify(result), 503

    # Save to database
    db     = load_db()
    record = {
        "id":         str(uuid.uuid4()),
        "user_id":    user_id,
        "filename":   filename,
        "label":      result["prediction"],
        "confidence": result["confidence"],
        "is_infected":result["is_infected"],
        "timestamp":  datetime.utcnow().isoformat()
    }
    db["predictions"].append(record)
    save_db(db)

    return jsonify({
        "prediction":      result["prediction"],
        "confidence":      result["confidence"],
        "is_infected":     result["is_infected"],
        "recommendations": result.get("recommendations", []),
        "raw_probability": result.get("raw_probability"),
        "threshold_used":  result.get("threshold_used"),
        "cow_confidence":  result.get("cow_confidence"),
        "case_id":         record["id"],
        "saved_image":     filename,
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
    # Predictor already loaded at startup via get_or_init_predictor()
    app.run(debug=True, port=5000)