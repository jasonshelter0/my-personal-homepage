# Production packaging

The release builder must be Linux x86_64 with Node 24.21.0. Run `npm ci`, the
checks in the root README, and `npm run build` before preparing the Docker build
context. The image intentionally includes build dependencies because the owner
can create new static previews and releases from the editor at runtime.

The base image is the official `node:24.21.0-bookworm-slim`, pinned to the
Linux/amd64 manifest digest
`sha256:51b1100cc2a83d370c6a60952e3f2989c8a43159d0e38586e090f3b3326efefd`.
It was resolved from the official Docker Hub registry on 2026-10-25. The release
machine has no Docker CLI; the final container build and read-only runtime test
must run on the authorized deployment host.

## Build and startup

From the reviewed, unpacked release context on the server:

```sh
docker build --pull=false --platform linux/amd64 -t folio-studio:RELEASE_ID .
docker image inspect --format '{{.Id}}' folio-studio:RELEASE_ID
```

Record the returned immutable image ID in the deployment's non-secret
`image.env` as `FOLIO_IMAGE=sha256:...`. Do not use a mutable image tag as the
Compose deployment input. The fixed project name is `folio-studio`, service is
`studio`, and the persistent data directory is always
`/www/dk_project/folio-studio/shared/data` (owned by numeric UID/GID 10001).
Create this directory explicitly; Compose must not silently create an empty
replacement. Create `/www/dk_project/folio-studio/config/studio.env` with mode
0600 and an `ADMIN_PASSWORD` obtained through the separate secure handoff.
Optional translation provider values also belong in that file. Never print it
or run unfiltered `docker compose config`.

With a real published release already initialized in the data directory:

```sh
docker compose --env-file /www/dk_project/folio-studio/config/image.env \
  -p folio-studio -f /www/dk_project/folio-studio/current/deploy/compose.production.yml \
  up -d --no-build --pull never
curl --fail --silent http://127.0.0.1:18080/healthz
```

`/healthz` is read-only and returns 200 only when the database, editor bundle and
published website are ready. A running container with a 503 health response is
not ready for Nginx cutover. Verify a real authenticated preview build inside
the read-only container before switching the public entrypoint.

The service uses host networking and binds only to `127.0.0.1:18080`; no Docker
port-publishing rule is created. This avoids Docker 26's historical caveat with
localhost-published ports. Host networking grants network access to the host:
keep the exact loopback bind, never use `0.0.0.0`, and verify socket ownership.
The root filesystem is read-only. Astro's generated types and Vite configuration cache are symlinked into the
256 MiB `/tmp` tmpfs. Prerender chunks use `/data/build-cache/astro-prerender`
because Astro renames assets into the release directory on the same filesystem; source files,
dependencies and editor assets remain immutable. `/data` is the only persistent
write mount. The service runs as UID 10001 with all capabilities dropped.

Memory is capped at 768 MiB, CPU at 1.5 cores, process count at 192, and each Node
process at a 384 MiB JS heap. These are initial budgets, not measured resource
requirements. Verify container peak memory during publication and host free
memory before cutover; do not claim zero-downtime updates on the 1.8 GiB host.
Container logs rotate at 10 MiB × 3 files; no host-wide cleanup is performed.

## Nginx and rollback

`nginx-site.candidate.conf` describes the target routing and reuses the existing
certificate files and WordPress ACME webroot. The actual BaoTa-owned candidate
must preserve its verified TLS settings and certificate renewal includes, and
must pass the full existing Nginx configuration check before reload. The old
WordPress files, PHP service, MySQL and external RDS remain in place.

Before cutover, record the old site configuration, owners/modes, current target,
previous image ID and new deployment manifest in a restricted server backup.
On verification failure, restore the old site configuration, test the full
Nginx config, reload, and verify the old static WordPress resource and IP site.
Only then stop the new `studio` service if necessary. Never use `down -v`, prune,
or remove old data, images, certificates or backups as part of rollback.

For a later application rollback, restore the previous `FOLIO_IMAGE` value in
`image.env` and re-run the same Compose `up -d --no-build --pull never` command.
Changing the `current` symlink alone does not update a running container.
Database recovery is separate: SQLite plus media and release files must be
backed up consistently; stop the service before a filesystem backup or use a
coordinated SQLite online backup. Do not copy a live SQLite main file alone.

References: [Docker Compose service settings](https://docs.docker.com/reference/compose-file/services/),
[Docker port publishing](https://docs.docker.com/engine/network/port-publishing/).

## Offline base-image loading

When Docker Hub is unavailable from ECS, load the verified official image archive and verify its image ID before building. This release uses `sha256:470015c1ab1577c19efce2e80cdad4afd9c682cf8f4dcf3dccae5abfd9113397` for the verified Node base. The production handoff records archive checksums.

Version 1.2.0 successfully used the modern Docker BuildKit builder offline with
the loaded `node:24.21.0-bookworm-slim` tag. Verify that tag's image ID against
the value above immediately before building, then pass
`--pull=false --platform linux/amd64 --build-arg BASE_IMAGE=node:24.21.0-bookworm-slim`.
Verify the resulting application's root filesystem layers begin with the same
base-image layers, and record the immutable application image ID for Compose.
This verified local-tag approach is the preferred offline path on this server.

Docker 26 BuildKit interprets a bare `sha256:...` in `FROM` as a registry image name, so it cannot use that argument directly. This first deployment used `DOCKER_BUILDKIT=0 docker build --pull=false --platform linux/amd64 --build-arg BASE_IMAGE=sha256:470015c1ab1577c19efce2e80cdad4afd9c682cf8f4dcf3dccae5abfd9113397 -t folio-studio:1.1.0-3ac5106 .` to build offline from the exact local image ID. The legacy builder is deprecated; this is a recorded bootstrap workaround, not a runtime dependency. For subsequent builds, prefer the pinned registry digest with BuildKit when registry access is available, or a local tag whose image ID has been checked against the verified archive immediately before building. Never substitute an unverified mirror or floating base image. Compose always runs the exact resulting application image ID.
