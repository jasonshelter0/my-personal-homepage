#!/bin/sh
set -eu
mkdir -p /tmp/astro-types /tmp/astro-cache /tmp/vite-config
exec "$@"
