import tensorflow as tf

model = tf.keras.models.load_model("model/lsd_model.h5", compile=False)
model.save("model/lsd_model_tf213.h5")

print("Model converted successfully")