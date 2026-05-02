import tensorflow as tf

model = tf.keras.models.load_model("backend/model/lsd_model_tf213.h5", compile=False)

model_config = model.get_config()
new_model = tf.keras.Model.from_config(model_config)

new_model.set_weights(model.get_weights())

new_model.save("backend/model/lsd_model_clean.keras")

print("Clean model saved successfully")