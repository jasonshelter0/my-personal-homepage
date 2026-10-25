#!/bin/sh
set -eu
mkdir -p /tmp/astro-types /tmp/astro-cache /tmp/vite-config /data/build-cache/astro-prerender
# Node resolves the real path of generated prerender modules. Keep package
# resolution working after moving this cache outside /app.
if [ ! -e /data/build-cache/node_modules ]; then
    ln -s /app/node_modules /data/build-cache/node_modules
fi
exec "$@"
