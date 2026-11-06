# Processing job for one uploaded clip: proxy, mezzanine, scene changes and a poster frame.
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /job
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.mjs lib.mjs ./
CMD ["node", "index.mjs"]
