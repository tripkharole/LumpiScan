"""
CattleCare AI — FIXED Training Script
=====================================
Root cause diagnosis from model analysis:

BOTH models are:
  - MobileNetV2 base (frozen, trainable=False)
  - GlobalAveragePooling2D → BatchNorm → Dense(128,relu) → Dropout → Dense(1,sigmoid)
  - Output: sigmoid → single float [0,1]

ROOT CAUSE OF "always predicts Lumpy":
  1. CLASS INDEX BUG: Keras assigns classes alphabetically.
     - "healthy" (h) < "lumpy" (l) → index 0=healthy, 1=lumpy
     - sigmoid output > 0.5 = class 1 = LUMPY
     - But your old inference code likely did:
         CLASS_NAMES[round(pred)] with wrong order
         OR used argmax on single sigmoid output (WRONG)
  
  2. DATASET IMBALANCE: You added more lumpy images → model learned
     to always predict 1 (lumpy) to minimize loss.
     Fix: class_weight balancing during training.
  
  3. THRESHOLD NOT TUNED: Default 0.5 may not be optimal.
     If training data is 70% lumpy, bias toward lumpy.
     Fix: tune threshold using ROC curve.
  
  4. BASE MODEL FROZEN ENTIRELY: MobileNetV2 pretrained on ImageNet.
     Cow skin lesions need domain-specific features.
     Fix: unfreeze top 30 layers and fine-tune.

Dataset folder structure (MUST use exactly these names):
  dataset/
    train/
      healthy/    ← class index 0  (alphabetical)
      lumpy/      ← class index 1  (alphabetical)
    val/
      healthy/
      lumpy/
    test/
      healthy/
      lumpy/
"""

import os, json
import numpy as np
import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.models import Sequential, Model
from tensorflow.keras.layers import (
    Dense, GlobalAveragePooling2D, Dropout,
    BatchNormalization, Input
)
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks import (
    ModelCheckpoint, EarlyStopping, ReduceLROnPlateau, CSVLogger
)
from sklearn.metrics import (
    confusion_matrix, classification_report,
    ConfusionMatrixDisplay, roc_curve, auc
)
import matplotlib.pyplot as plt
from PIL import Image

# ─── CONFIG ───────────────────────────────────────────────────────────────────
IMG_SIZE        = 224
BATCH_SIZE      = 16
EPOCHS_FROZEN   = 12
EPOCHS_FINETUNE = 15
DATASET_DIR     = "dataset"
LSD_MODEL_PATH  = "lsd_final.keras"
COW_MODEL_PATH  = "cow_or_not_final.keras"
# ─────────────────────────────────────────────────────────────────────────────


# ════════════════════════════════════════════════════════════════════════
# STEP 0 — DATASET DIAGNOSTICS
# ════════════════════════════════════════════════════════════════════════
def diagnose_dataset(dataset_dir):
    print("\n" + "="*60)
    print("DATASET DIAGNOSTICS")
    print("="*60)
    splits = ["train", "val", "test"]
    all_files, counts = {}, {}

    for split in splits:
        split_dir = os.path.join(dataset_dir, split)
        if not os.path.exists(split_dir):
            continue
        all_files[split], counts[split] = {}, {}
        for cls in sorted(os.listdir(split_dir)):
            cls_dir = os.path.join(split_dir, cls)
            if not os.path.isdir(cls_dir): continue
            files = [f for f in os.listdir(cls_dir)
                     if f.lower().endswith((".jpg",".jpeg",".png",".bmp",".webp"))]
            all_files[split][cls] = set(files)
            counts[split][cls]    = len(files)
            print(f"  {split:6} / {cls:14} → {len(files):4} images")
            bad = sum(1 for f in files if not _check_image(os.path.join(cls_dir, f)))
            if bad: print(f"    ⚠️  {bad} CORRUPTED — delete before training!")

    # Imbalance check
    if "train" in counts and len(counts["train"]) == 2:
        cls_list = sorted(counts["train"].keys())
        c0, c1   = counts["train"][cls_list[0]], counts["train"][cls_list[1]]
        ratio    = max(c0,c1) / max(min(c0,c1), 1)
        status   = f"⚠️  IMBALANCED ({ratio:.1f}x) — class_weight will fix" if ratio > 1.5 else "✅ Balanced"
        print(f"\n  {cls_list[0]}: {c0} | {cls_list[1]}: {c1} | Ratio: {ratio:.1f}x  {status}")

    # Data leakage check
    if "train" in all_files and "val" in all_files:
        print("\n  Data leakage check (train vs val):")
        for cls in all_files.get("train", {}):
            leak = all_files["train"].get(cls,set()) & all_files.get("val",{}).get(cls,set())
            msg  = f"❌ {len(leak)} LEAKING FILES" if leak else "✅ clean"
            print(f"    {cls}: {msg}")

    print("="*60 + "\n")
    return counts


def _check_image(path):
    try:
        img = Image.open(path); img.verify(); return True
    except: return False


def compute_class_weights(counts, split="train"):
    if split not in counts: return None
    classes = sorted(counts[split].keys())   # alphabetical = Keras order
    n       = [counts[split][c] for c in classes]
    total   = sum(n)
    weights = {i: total / (len(n) * max(ni,1)) for i,ni in enumerate(n)}
    print(f"  Class weights → {dict(zip(range(len(classes)), [f'{w:.3f}' for w in weights.values()]))}")
    print(f"  (index 0={classes[0]}, index 1={classes[1]})")
    return weights


# ════════════════════════════════════════════════════════════════════════
# STEP 1 — DATA GENERATORS
# ════════════════════════════════════════════════════════════════════════
def get_generators(dataset_dir=DATASET_DIR, task="lsd"):
    """
    task='lsd'      → train/val split for disease detection
    task='cow'      → train/val split for cow-or-not detection
    """
    # CRITICAL: exact same preprocessing as MobileNetV2 expects
    preprocess = tf.keras.applications.mobilenet_v2.preprocess_input

    train_aug = ImageDataGenerator(
        preprocessing_function=preprocess,
        rotation_range=20,
        zoom_range=0.15,
        horizontal_flip=True,
        shear_range=0.1,
        brightness_range=[0.8, 1.2],
        fill_mode="nearest"
    )
    val_aug = ImageDataGenerator(preprocessing_function=preprocess)

    train_data = train_aug.flow_from_directory(
        os.path.join(dataset_dir, "train"),
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode="binary",    # sigmoid output → binary labels
        shuffle=True,
        seed=42
    )
    val_data = val_aug.flow_from_directory(
        os.path.join(dataset_dir, "val"),
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode="binary",
        shuffle=False           # MUST be False for correct evaluation
    )

    # Log and save class mapping — THIS IS THE CRITICAL FIX
    print(f"\n  [{task.upper()}] Keras class mapping (alphabetical order):")
    class_indices = train_data.class_indices
    for cls, idx in sorted(class_indices.items(), key=lambda x: x[1]):
        print(f"    index {idx} → '{cls}'  ← inference must use this exact mapping")

    mapping = {str(v): k for k,v in class_indices.items()}
    map_path = f"class_mapping_{task}.json"
    with open(map_path, "w") as f:
        json.dump(mapping, f, indent=2)
    print(f"  ✅ Saved {map_path} — inference loads this file")

    return train_data, val_data, mapping


# ════════════════════════════════════════════════════════════════════════
# STEP 2 — MODEL ARCHITECTURE
# Matches exactly the architecture in your uploaded .keras files
# ════════════════════════════════════════════════════════════════════════
def build_model(dropout_rate=0.5):
    """
    Matches your uploaded model architecture:
    MobileNetV2 → GAP → BN → Dense(128,relu) → Dropout → Dense(1,sigmoid)
    
    FIX: sigmoid + binary_crossentropy is CORRECT for binary classification.
    Your architecture is fine. The bugs were in:
      1. Class mapping during inference
      2. Dataset imbalance
      3. No fine-tuning
    """
    base = MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights="imagenet"
    )
    base.trainable = False

    inputs = Input(shape=(IMG_SIZE, IMG_SIZE, 3))
    x = base(inputs, training=False)
    x = GlobalAveragePooling2D()(x)
    x = BatchNormalization()(x)
    x = Dense(128, activation="relu")(x)
    x = Dropout(dropout_rate)(x)
    output = Dense(1, activation="sigmoid")(x)

    model = Model(inputs, output)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="binary_crossentropy",
        metrics=[
            "accuracy",
            tf.keras.metrics.AUC(name="auc"),
            tf.keras.metrics.Precision(name="precision"),
            tf.keras.metrics.Recall(name="recall")
        ]
    )
    return model, base


def unfreeze_top(model, base, n=30):
    """Unfreeze top N layers for fine-tuning."""
    base.trainable = True
    for layer in base.layers[:-n]:
        layer.trainable = False
    unfrozen = sum(1 for l in base.layers if l.trainable)
    print(f"  Fine-tune: {unfrozen}/{len(base.layers)} base layers trainable")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
        loss="binary_crossentropy",
        metrics=["accuracy", tf.keras.metrics.AUC(name="auc"),
                 tf.keras.metrics.Precision(name="precision"),
                 tf.keras.metrics.Recall(name="recall")]
    )
    return model


# ════════════════════════════════════════════════════════════════════════
# STEP 3 — FIND OPTIMAL THRESHOLD
# ════════════════════════════════════════════════════════════════════════
def find_optimal_threshold(model, val_data):
    """
    Use ROC curve to find the threshold that maximizes Youden's J statistic
    (Sensitivity + Specificity - 1). Saves threshold to threshold.json.
    """
    val_data.reset()
    y_prob = model.predict(val_data, verbose=0).flatten()
    y_true = val_data.classes

    fpr, tpr, thresholds = roc_curve(y_true, y_prob)
    roc_auc = auc(fpr, tpr)

    # Youden's J: maximize (TPR - FPR)
    j_scores  = tpr - fpr
    best_idx  = np.argmax(j_scores)
    best_thr  = float(thresholds[best_idx])

    print(f"\n  ROC-AUC: {roc_auc:.4f}")
    print(f"  Optimal threshold (Youden's J): {best_thr:.4f}")
    print(f"  At this threshold → TPR={tpr[best_idx]:.3f}, FPR={fpr[best_idx]:.3f}")

    # Plot ROC
    plt.figure(figsize=(6,5))
    plt.plot(fpr, tpr, label=f"ROC (AUC={roc_auc:.3f})")
    plt.scatter(fpr[best_idx], tpr[best_idx], color="red", zorder=5,
                label=f"Best threshold={best_thr:.2f}")
    plt.plot([0,1],[0,1],"k--"); plt.xlabel("FPR"); plt.ylabel("TPR")
    plt.title("ROC Curve"); plt.legend()
    plt.savefig("roc_curve.png", dpi=150); plt.close()
    print("  ✅ Saved roc_curve.png")

    return best_thr


# ════════════════════════════════════════════════════════════════════════
# STEP 4 — FULL EVALUATION
# ════════════════════════════════════════════════════════════════════════
def evaluate_model(model, val_data, class_mapping, threshold=0.5, tag="lsd"):
    print(f"\n{'='*60}\nEVALUATION: {tag.upper()}  (threshold={threshold:.3f})\n{'='*60}")

    val_data.reset()
    y_prob = model.predict(val_data, verbose=1).flatten()
    y_pred = (y_prob > threshold).astype(int)
    y_true = val_data.classes
    idx_to_class = {int(k): v for k,v in class_mapping.items()}
    class_names  = [idx_to_class[i] for i in sorted(idx_to_class)]

    cm = confusion_matrix(y_true, y_pred)
    TN,FP,FN,TP = cm[0,0], cm[0,1], cm[1,0], cm[1,1]

    print(f"\n  Confusion Matrix:\n{cm}")
    print(f"  TN={TN}  FP={FP}  FN={FN}  TP={TP}")
    if FP: print(f"  ⚠️  {FP} False Positives: healthy images predicted as lumpy")
    if FN: print(f"  ⚠️  {FN} False Negatives: lumpy images predicted as healthy")
    print(f"\n{classification_report(y_true, y_pred, target_names=class_names)}")

    # Plots
    fig, axes = plt.subplots(1, 3, figsize=(16, 5))

    ConfusionMatrixDisplay(cm, display_labels=class_names).plot(
        ax=axes[0], colorbar=False, cmap="Blues")
    axes[0].set_title("Confusion Matrix")

    axes[1].hist(y_prob[y_true==0], bins=20, alpha=0.6, color="green", label=class_names[0])
    axes[1].hist(y_prob[y_true==1], bins=20, alpha=0.6, color="red",   label=class_names[1])
    axes[1].axvline(threshold, color="black", linestyle="--", label=f"Threshold={threshold:.2f}")
    axes[1].set_xlabel("Predicted Probability"); axes[1].set_title("Prediction Distribution")
    axes[1].legend()

    axes[2].axis("off")
    acc  = (TP+TN)/max(TP+TN+FP+FN,1)
    prec = TP/max(TP+FP,1); rec = TP/max(TP+FN,1)
    f1   = 2*TP/max(2*TP+FP+FN,1)
    axes[2].text(0.05, 0.5,
        f"Accuracy  : {acc:.3f}\nPrecision : {prec:.3f}\nRecall    : {rec:.3f}\n"
        f"F1-Score  : {f1:.3f}\nFP Rate   : {FP/max(FP+TN,1):.3f}\n"
        f"FN Rate   : {FN/max(FN+TP,1):.3f}\nAUC-ROC   : (see roc_curve.png)",
        transform=axes[2].transAxes, fontsize=12, va="center",
        fontfamily="monospace",
        bbox=dict(boxstyle="round", facecolor="wheat", alpha=0.5))
    axes[2].set_title("Metrics Summary")

    plt.tight_layout()
    plt.savefig(f"eval_{tag}.png", dpi=150); plt.close()
    print(f"  ✅ Saved eval_{tag}.png")

    # Threshold sweep table
    print(f"\n  {'Thr':>6} {'Acc':>8} {'Prec':>8} {'Rec':>8} {'F1':>8} {'FP':>5} {'FN':>5}")
    for t in [0.30, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70]:
        yp   = (y_prob > t).astype(int)
        cm_t = confusion_matrix(y_true, yp)
        tp,tn,fp,fn = cm_t[1,1],cm_t[0,0],cm_t[0,1],cm_t[1,0]
        a = (tp+tn)/max(tp+tn+fp+fn,1); p = tp/max(tp+fp,1)
        r = tp/max(tp+fn,1);            f = 2*tp/max(2*tp+fp+fn,1)
        marker = " ◄" if abs(t-threshold)<0.01 else ""
        print(f"  {t:>6.2f} {a:>8.3f} {p:>8.3f} {r:>8.3f} {f:>8.3f} {fp:>5} {fn:>5}{marker}")

    return y_prob, y_pred


# ════════════════════════════════════════════════════════════════════════
# STEP 5 — TRAIN ONE MODEL
# ════════════════════════════════════════════════════════════════════════
def train_one_model(dataset_dir, model_save_path, task="lsd", dropout=0.5):
    print(f"\n{'#'*60}")
    print(f"  TRAINING: {task.upper()} → {model_save_path}")
    print(f"{'#'*60}")

    counts = diagnose_dataset(dataset_dir)
    train_data, val_data, class_mapping = get_generators(dataset_dir, task)
    class_weights = compute_class_weights(counts)
    model, base   = build_model(dropout_rate=dropout)

    def callbacks(tag):
        return [
            ModelCheckpoint(model_save_path, save_best_only=True,
                            monitor="val_auc", mode="max", verbose=1),
            EarlyStopping(patience=6, restore_best_weights=True,
                          monitor="val_auc", mode="max", verbose=1),
            ReduceLROnPlateau(factor=0.3, patience=3, min_lr=1e-8, verbose=1),
            CSVLogger(f"log_{tag}.csv")
        ]

    # Phase 1: frozen
    print(f"\n[Phase 1] Frozen base — {EPOCHS_FROZEN} epochs max")
    h1 = model.fit(train_data, validation_data=val_data,
                   epochs=EPOCHS_FROZEN, callbacks=callbacks(f"{task}_p1"),
                   class_weight=class_weights)

    # Phase 2: fine-tune
    print(f"\n[Phase 2] Fine-tune top 30 — {EPOCHS_FINETUNE} epochs max")
    model = unfreeze_top(model, base, n=30)
    h2 = model.fit(train_data, validation_data=val_data,
                   epochs=EPOCHS_FINETUNE, callbacks=callbacks(f"{task}_p2"),
                   class_weight=class_weights)

    # Plot history
    _plot_history(h1, h2, tag=task)

    # Find optimal threshold
    print(f"\n[Threshold] Finding optimal decision threshold...")
    threshold = find_optimal_threshold(model, val_data)

    # Save threshold alongside class mapping
    thr_path = f"threshold_{task}.json"
    with open(thr_path, "w") as f:
        json.dump({"threshold": threshold, "task": task}, f, indent=2)
    print(f"  ✅ Saved {thr_path}")

    # Full evaluation at optimal threshold
    evaluate_model(model, val_data, class_mapping, threshold=threshold, tag=task)

    print(f"\n  ✅ Model saved: {model_save_path}")
    return model, threshold


def _plot_history(h1, h2, tag):
    metrics = ["loss","accuracy","auc","precision","recall"]
    fig, axes = plt.subplots(1, len(metrics), figsize=(20,4))
    for ax, m in zip(axes, metrics):
        v  = h1.history.get(m,[]) + h2.history.get(m,[])
        vv = h1.history.get(f"val_{m}",[]) + h2.history.get(f"val_{m}",[])
        ax.plot(v, label="Train"); ax.plot(vv, label="Val", linestyle="--")
        ax.axvline(len(h1.history[m]), color="grey", linestyle=":", label="Fine-tune")
        ax.set_title(m.capitalize()); ax.legend(fontsize=7)
    plt.tight_layout()
    plt.savefig(f"history_{tag}.png", dpi=150); plt.close()
    print(f"  ✅ Saved history_{tag}.png")


# ════════════════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════════════════
def train():
    print("="*60)
    print("CattleCare AI — FIXED Training Pipeline")
    print("="*60)
    print("""
Expected dataset layout:
  ml_model/
    dataset_lsd/          ← disease detection dataset
      train/healthy/ + train/lumpy/
      val/healthy/   + val/lumpy/
    dataset_cow/          ← cow-or-not dataset
      train/cow/    + train/not_cow/
      val/cow/      + val/not_cow/
""")

    # Train LSD model
    train_one_model(
        dataset_dir="dataset_lsd",
        model_save_path=LSD_MODEL_PATH,
        task="lsd",
        dropout=0.5
    )

    # Train cow-or-not model (if dataset available)
    if os.path.exists("dataset_cow"):
        train_one_model(
            dataset_dir="dataset_cow",
            model_save_path=COW_MODEL_PATH,
            task="cow",
            dropout=0.3
        )
    else:
        print("\n  [COW MODEL] dataset_cow/ not found — skipping cow-or-not training")

    print("\n" + "="*60)
    print("ALL DONE")
    print("="*60)
    print("Files produced:")
    for f in [LSD_MODEL_PATH, COW_MODEL_PATH,
              "class_mapping_lsd.json", "class_mapping_cow.json",
              "threshold_lsd.json", "threshold_cow.json",
              "eval_lsd.png", "eval_cow.png", "roc_curve.png"]:
        exists = "✅" if os.path.exists(f) else "—"
        print(f"  {exists} {f}")


if __name__ == "__main__":
    train()