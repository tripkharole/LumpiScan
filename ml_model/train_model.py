"""
CattleCare AI - LSD Detection Model Training
Uses MobileNetV2 Transfer Learning for binary classification:
  - Class 0: Healthy
  - Class 1: Lumpy Skin Disease (LSD)

Dataset folder structure expected:
  dataset/
    train/
      healthy/    ← healthy cow skin images
      infected/   ← LSD-infected cow skin images
    val/
      healthy/
      infected/
"""

import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau
import matplotlib.pyplot as plt

# ─── CONFIG ───────────────────────────────────────────────────────────────────
IMG_SIZE    = 224
BATCH_SIZE  = 32
EPOCHS      = 20
DATASET_DIR = "dataset"
MODEL_PATH  = "lsd_model.h5"
# ──────────────────────────────────────────────────────────────────────────────


def build_model():
    """Build MobileNetV2 transfer learning model."""
    base = MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights="imagenet"
    )
    base.trainable = False  # Freeze pretrained layers

    x = base.output
    x = GlobalAveragePooling2D()(x)
    x = Dropout(0.3)(x)
    x = Dense(128, activation="relu")(x)
    x = Dropout(0.2)(x)
    output = Dense(2, activation="softmax")(x)  # [healthy, infected]

    model = Model(inputs=base.input, outputs=output)
    model.compile(
        optimizer="adam",
        loss="categorical_crossentropy",
        metrics=["accuracy"]
    )
    return model


def get_data_generators():
    """Create augmented train and validation data generators."""
    train_gen = ImageDataGenerator(
        preprocessing_function=tf.keras.applications.mobilenet_v2.preprocess_input,
        rotation_range=20,
        zoom_range=0.2,
        horizontal_flip=True,
        shear_range=0.1,
        brightness_range=[0.8, 1.2]
    )
    val_gen = ImageDataGenerator(
        preprocessing_function=tf.keras.applications.mobilenet_v2.preprocess_input
    )

    train_data = train_gen.flow_from_directory(
        os.path.join(DATASET_DIR, "train"),
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode="categorical"
    )
    val_data = val_gen.flow_from_directory(
        os.path.join(DATASET_DIR, "val"),
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode="categorical"
    )
    return train_data, val_data


def train():
    print("=== CattleCare AI - Model Training ===\n")
    model = build_model()
    model.summary()

    train_data, val_data = get_data_generators()

    callbacks = [
        ModelCheckpoint(MODEL_PATH, save_best_only=True, monitor="val_accuracy", verbose=1),
        EarlyStopping(patience=5, restore_best_weights=True, verbose=1),
        ReduceLROnPlateau(factor=0.5, patience=3, verbose=1)
    ]

    history = model.fit(
        train_data,
        validation_data=val_data,
        epochs=EPOCHS,
        callbacks=callbacks
    )

    # Plot results
    plt.figure(figsize=(12, 4))
    plt.subplot(1, 2, 1)
    plt.plot(history.history["accuracy"], label="Train Acc")
    plt.plot(history.history["val_accuracy"], label="Val Acc")
    plt.title("Accuracy"); plt.legend()

    plt.subplot(1, 2, 2)
    plt.plot(history.history["loss"], label="Train Loss")
    plt.plot(history.history["val_loss"], label="Val Loss")
    plt.title("Loss"); plt.legend()

    plt.tight_layout()
    plt.savefig("training_results.png")
    print(f"\n✅ Model saved to {MODEL_PATH}")
    print("✅ Training plot saved to training_results.png")


if __name__ == "__main__":
    train()
