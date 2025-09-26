# --- Build TS ---
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY types ./types
RUN npm run build   # genera ./dist

# --- Runtime ---
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev

# Copia el build
COPY --from=build /app/dist ./dist

# 👇 Copia el código fuente SOLO porque tus migraciones están en src/
COPY --from=build /app/src ./src

RUN mkdir -p /app/uploads
EXPOSE 3000
CMD ["node", "dist/server.js"]
