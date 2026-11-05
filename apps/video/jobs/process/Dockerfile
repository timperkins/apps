# Processing job for one uploaded clip. Phase 2: a hello-world that checks FFmpeg and Firestore.
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /job
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.mjs ./
CMD ["node", "index.mjs"]
