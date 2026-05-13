# gunicorn.conf.py
# Prevents WORKER TIMEOUT when loading TensorFlow models on Render free tier

workers      = 1        # single worker — avoids loading model multiple times
threads      = 2        # handle concurrent requests within one worker
timeout      = 300      # 5 minutes — enough for TF model to load on slow CPU
keepalive    = 5
bind         = "0.0.0.0:10000"   # Render uses port 10000 by default
worker_class = "sync"
preload_app  = True     # load model ONCE before forking — saves RAM
