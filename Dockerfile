# Dependencies and the admin bundle are prepared on the Linux x86_64 release
# builder using npm ci + npm run build. No package installation runs on ECS.
ARG BASE_IMAGE=node:24.21.0-bookworm-slim@sha256:51b1100cc2a83d370c6a60952e3f2989c8a43159d0e38586e090f3b3326efefd
FROM ${BASE_IMAGE}

WORKDIR /app
COPY --chown=10001:10001 package.json package-lock.json tsconfig.json ./
COPY --chown=10001:10001 node_modules ./node_modules
COPY --chown=10001:10001 server ./server
COPY --chown=10001:10001 shared ./shared
COPY --chown=10001:10001 scripts ./scripts
COPY --chown=10001:10001 apps/site ./apps/site
COPY --chown=10001:10001 apps/admin/dist ./apps/admin/dist
COPY --chown=10001:10001 deploy/container-entrypoint.sh ./deploy/container-entrypoint.sh

# Astro writes types beneath the site root and prerender chunks beneath the
# working directory. Vite's config loader also needs a writable cache.
RUN ln -s /tmp/astro-types /app/apps/site/.astro \
    && ln -s /tmp/astro-prerender /app/.astro \
    && ln -s /tmp/vite-config /app/node_modules/.vite-temp \
    && chmod 0555 /app/deploy/container-entrypoint.sh

ENV NODE_ENV=production \
    HOME=/tmp \
    TMPDIR=/tmp \
    ASTRO_TELEMETRY_DISABLED=1 \
    FOLIO_CACHE_DIR=/tmp/astro-cache \
    FOLIO_DATA_DIR=/data
USER 10001:10001
ENTRYPOINT ["/app/deploy/container-entrypoint.sh"]
CMD ["node", "--import", "tsx", "server/index.ts"]
