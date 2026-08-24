FROM node:24-bookworm-slim AS dependencies
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/site/package.json apps/site/package.json
COPY apps/mobile/package.json apps/mobile/package.json
RUN npm ci

FROM dependencies AS build
COPY apps/api apps/api
RUN npm run prisma:generate --workspace=@cleaning-robot/api \
    && npm run build --workspace=@cleaning-robot/api

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
ARG APP_VERSION=0.0.0-dev
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown
LABEL org.opencontainers.image.title="Robot Platform NestJS Runtime" \
      org.opencontainers.image.version="$APP_VERSION" \
      org.opencontainers.image.revision="$GIT_COMMIT" \
      org.opencontainers.image.created="$BUILD_TIME"
ENV NODE_ENV=production \
    APP_VERSION=$APP_VERSION \
    GIT_COMMIT=$GIT_COMMIT \
    BUILD_TIME=$BUILD_TIME \
    HEALTHCHECK_URL=http://127.0.0.1:3000/health
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /workspace/node_modules node_modules
COPY --from=build --chown=node:node /workspace/apps/api/dist apps/api/dist
COPY --from=build --chown=node:node /workspace/apps/api/prisma apps/api/prisma
COPY --from=build --chown=node:node /workspace/apps/api/package.json apps/api/package.json
USER node
EXPOSE 3000 9464
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 CMD ["node", "-e", "fetch(process.env.HEALTHCHECK_URL).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "apps/api/dist/main.js"]

FROM runtime AS worker
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git python3 python3-venv \
    && python3 -m venv /opt/dvc \
    && /opt/dvc/bin/pip install --no-cache-dir "dvc[s3]==3.67.1" \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/data \
    && chown -R node:node /app/data /opt/dvc
ENV PATH="/opt/dvc/bin:$PATH" DVC_COMMAND=/opt/dvc/bin/dvc
USER node
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 CMD ["node", "-e", "try{process.kill(1,0)}catch{process.exit(1)}"]
CMD ["node", "apps/api/dist/worker.js"]

FROM build AS migration
ARG APP_VERSION=0.0.0-dev
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown
LABEL org.opencontainers.image.title="Robot Platform Prisma Migration" \
      org.opencontainers.image.version="$APP_VERSION" \
      org.opencontainers.image.revision="$GIT_COMMIT" \
      org.opencontainers.image.created="$BUILD_TIME"
ENV NODE_ENV=production APP_VERSION=$APP_VERSION GIT_COMMIT=$GIT_COMMIT BUILD_TIME=$BUILD_TIME
USER node
CMD ["./node_modules/.bin/prisma", "migrate", "deploy", "--schema", "apps/api/prisma/schema.prisma"]
