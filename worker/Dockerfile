FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY lib/ ./lib/
COPY worker/ ./worker/
COPY prisma/ ./prisma/

RUN npx tsc --outDir dist --skipLibCheck --esModuleInterop --module commonjs --moduleResolution node --target es2020 worker/index.ts || true

RUN npx playwright install chromium --with-deps

ENV NODE_ENV=production

CMD ["node", "dist/worker/index.js"]
