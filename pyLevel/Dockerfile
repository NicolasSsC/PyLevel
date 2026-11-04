FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG APP_ORIGIN
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends python3 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PYTHON_BIN=python3 PYTHONDONTWRITEBYTECODE=1
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/migrations ./migrations
COPY --from=build --chown=node:node /app/scripts/migrate.mjs /app/scripts/migration-runner.mjs /app/scripts/seed-catalog.mjs ./scripts/
COPY --from=build --chown=node:node /app/src/lib ./src/lib
COPY --from=build --chown=node:node /app/src/ai ./src/ai
COPY --from=build --chown=node:node /app/src/admin ./src/admin
COPY --from=build --chown=node:node /app/src/core ./src/core
USER node
EXPOSE 8080
CMD ["npm", "start"]
