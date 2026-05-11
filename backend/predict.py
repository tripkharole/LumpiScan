"""
CattleCare AI — Self-Contained Inference Pipeline
All models live inside backend/models/ — no external dependencies.

backend/
  predict.py
  app.py
  requirements.txt
  models/
    lsd_final.keras
    cow_or_not_final.keras
    class_mapping_lsd.json
    class_mapping_cow.json
    threshold_lsd.json
    threshold_cow.json
  uploads/
  database.json
"""

import os, json
import numpy as np
from PIL import Image
import tensorflow as tf
import keras

# ── PATHS (all inside backend/models/) ────────────────────────────────────────
BASE_DIR       = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR     = os.path.join(BASE_DIR, "models")
LSD_MODEL_PATH = os.path.join(MODELS_DIR, "lsd_final.keras")
COW_MODEL_PATH = os.path.join(MODELS_DIR, "cow_or_not_final.keras")
LSD_MAP_PATH   = os.path.join(MODELS_DIR, "class_mapping_lsd.json")
COW_MAP_PATH   = os.path.join(MODELS_DIR, "class_mapping_cow.json")
LSD_THR_PATH   = os.path.join(MODELS_DIR, "threshold_lsd.json")
COW_THR_PATH   = os.path.join(MODELS_DIR, "threshold_cow.json")
IMG_SIZE       = 224
# ─────────────────────────────────────────────────────────────────────────────


def _load_class_mapping(path, fallback):
    if os.path.exists(path):
        with open(path) as f:
            return {int(k): v for k, v in json.load(f).items()}
    print(f"[WARN] {os.path.basename(path)} not found — using {fallback}")
    return fallback


def _load_threshold(path, fallback=0.5):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f).get("threshold", fallback)
    print(f"[WARN] {os.path.basename(path)} not found — using threshold={fallback}")
    return fallback


def _load_model(path, name):
    resolved = os.path.abspath(path)
    print(f"[MODEL:{name}] Path   : {resolved}")
    print(f"[MODEL:{name}] Exists : {os.path.exists(resolved)}")
    if not os.path.exists(resolved):
        print(f"[MODEL:{name}] ⚠️  Not found")
        return None, f"File not found: {resolved}"
    try:
        model = keras.saving.load_model(resolved, compile=False)
        print(f"[MODEL:{name}] ✅ Loaded  output={model.output_shape}")
        return model, None
    except Exception as e1:
        try:
            model = tf.keras.models.load_model(resolved, compile=False)
            print(f"[MODEL:{name}] ✅ Loaded via tf.keras fallback")
            return model, None
        except Exception as e2:
            print(f"[MODEL:{name}] ❌ Failed: {e2}")
            return None, str(e2)


class CattleCarePredictor:
    def __init__(self):
        self.lsd_map = _load_class_mapping(LSD_MAP_PATH, {0:"healthy",1:"lumpy"})
        self.cow_map = _load_class_mapping(COW_MAP_PATH, {0:"cow",1:"not_cow"})
        self.lsd_threshold = _load_threshold(LSD_THR_PATH, 0.5)
        self.cow_threshold = _load_threshold(COW_THR_PATH, 0.5)

        print(f"[INIT] LSD class mapping  : {self.lsd_map}")
        print(f"[INIT] COW class mapping  : {self.cow_map}")
        print(f"[INIT] LSD threshold      : {self.lsd_threshold}")
        print(f"[INIT] COW threshold      : {self.cow_threshold}")

        self.lsd_model, self.lsd_error = _load_model(LSD_MODEL_PATH, "LSD")
        self.cow_model, self.cow_error = _load_model(COW_MODEL_PATH, "COW")

    @staticmethod
    def preprocess(image_bytes):
        img = Image.open(image_bytes).convert("RGB")
        img = img.resize((IMG_SIZE, IMG_SIZE), Image.BILINEAR)
        arr = np.array(img, dtype=np.float32)
        arr = tf.keras.applications.mobilenet_v2.preprocess_input(arr)
        return np.expand_dims(arr, axis=0)

    def is_cow_image(self, image_bytes):
        if self.cow_model is None:
            print("[COW] Model not loaded — skipping cow check")
            return True, 100.0, 1.0
        arr      = self.preprocess(image_bytes)
        raw_prob = float(self.cow_model.predict(arr, verbose=0)[0][0])
        class_1  = self.cow_map.get(1, "not_cow")
        is_cow_at_1 = "cow" in class_1.lower() and "not" not in class_1.lower()
        if is_cow_at_1:
            is_cow = raw_prob > self.cow_threshold
            conf   = raw_prob if is_cow else 1 - raw_prob
        else:
            is_cow = raw_prob <= self.cow_threshold
            conf   = 1 - raw_prob if is_cow else raw_prob
        print(f"[COW] raw_prob={raw_prob:.4f} | class_1='{class_1}' | is_cow={is_cow} | conf={conf:.4f}")
        return is_cow, round(conf * 100, 2), raw_prob

    def predict_lsd(self, image_bytes):
        if self.lsd_model is None:
            return {"error": "LSD model not loaded", "model_error": self.lsd_error}
        arr        = self.preprocess(image_bytes)
        raw_prob   = float(self.lsd_model.predict(arr, verbose=0)[0][0])
        class_0    = self.lsd_map.get(0, "healthy")
        class_1    = self.lsd_map.get(1, "lumpy")
        is_class_1 = raw_prob > self.lsd_threshold
        pred_label = class_1 if is_class_1 else class_0
        confidence = raw_prob if is_class_1 else (1 - raw_prob)
        is_infected = "healthy" not in pred_label.lower()
        print(f"[LSD] raw_prob={raw_prob:.4f} | prediction='{pred_label}' | conf={confidence:.4f}")
        recs = ([
            "Immediately isolate the animal from the herd.",
            "Contact a registered veterinarian as soon as possible.",
            "Administer prescribed anti-inflammatory medication.",
            "Apply insect/vector control in the barn.",
            "Report to local livestock disease authority.",
        ] if is_infected else [
            "Animal appears healthy. Continue regular monitoring.",
            "Maintain vaccination schedule.",
            "Ensure clean water and proper nutrition.",
        ])
        return {
            "prediction": pred_label, "confidence": round(confidence * 100, 2),
            "is_infected": is_infected, "raw_probability": round(raw_prob, 4),
            "threshold_used": self.lsd_threshold, "recommendations": recs,
        }

    def predict(self, image_bytes):
        is_cow, cow_conf, _ = self.is_cow_image(image_bytes)
        if not is_cow:
            return {"is_cow": False, "error": "not_a_cow",
                    "message": "Please upload a valid cow image.",
                    "cow_confidence": cow_conf}
        if hasattr(image_bytes, "seek"):
            image_bytes.seek(0)
        result = self.predict_lsd(image_bytes)
        result["is_cow"] = True
        result["cow_confidence"] = cow_conf
        return result


_predictor = None
def get_predictor():
    global _predictor
    if _predictor is None:
        print("[STARTUP] Loading CattleCare predictor...")
        _predictor = CattleCarePredictor()
    return _predictor