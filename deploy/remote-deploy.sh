#!/usr/bin/env bash
# Runs on the server, called by .github/workflows/deploy.yml after the image
# tarball and this deploy/ folder were copied to the project directory.
#
# 1. Loads the new image.
# 2. If TURN_SECRET is set: (re)starts the coturn relay as its own compose
#    project and gives the app its TURN settings through a compose override
#    file (the server's own compose file is never edited). See Docs/TURN.md.
# 3. Restarts the app exactly as before (docker compose down / up -d).
#
# Any TURN problem stops the script before step 3, so the running bar is
# never taken down by a bad TURN setup.
#
# Env: IMAGE_TAG (required), TURN_SECRET, TURN_HOST, TURN_APP_SERVICE.
set -euo pipefail

cd "$(dirname "$0")/.."

: "${IMAGE_TAG:?IMAGE_TAG is required}"
export IMAGE_TAG
TURN_SECRET="${TURN_SECRET:-}"
TURN_HOST="${TURN_HOST:-taberna.d.jacobocaraballo.com}"
TURN_APP_SERVICE="${TURN_APP_SERVICE:-}"
OVERRIDE_MARKER="# managed-by: gamedevbar deploy (TURN). Regenerated on every deploy; don't edit."

fail() {
    echo "::error::$1" >&2
    exit 1
}

docker load -i ./jacobocaraballo-taberna.tar

# The file `docker compose` picks by default, and the override it merges automatically.
base=""
for candidate in compose.yaml compose.yml docker-compose.yaml docker-compose.yml; do
    if [ -f "$candidate" ]; then
        base="$candidate"
        break
    fi
done
[ -n "$base" ] || fail "No compose file found in $(pwd)."
case "$base" in
    compose.*) override="compose.override.yaml" ;;
    *) override="docker-compose.override.yml" ;;
esac

if [ -n "$TURN_SECRET" ]; then
    # Hex/base64url only: the value is written into YAML and coturn's config.
    [[ "$TURN_SECRET" =~ ^[A-Za-z0-9_-]{16,}$ ]] \
        || fail "TURN_SECRET must be 16+ characters of [A-Za-z0-9_-] (use: openssl rand -hex 32)."
    [[ "$TURN_HOST" =~ ^[A-Za-z0-9.-]+$ ]] || fail "TURN_HOST is not a valid hostname: $TURN_HOST"

    if [ -f "$override" ] && ! grep -qF "$OVERRIDE_MARKER" "$override"; then
        fail "$override already exists and wasn't created by this workflow; not touching it. Add TURN_URLS/TURN_SECRET to the app service by hand (Docs/TURN.md)."
    fi

    if [ -z "$TURN_APP_SERVICE" ]; then
        services="$(docker compose -f "$base" config --services)"
        count="$(printf '%s\n' "$services" | grep -c .)" || true
        [ "$count" -eq 1 ] \
            || fail "Expected exactly one service in $base, found $count ($(echo $services)). Set the TURN_APP_SERVICE repository variable to the app's service name."
        TURN_APP_SERVICE="$services"
    fi
    [[ "$TURN_APP_SERVICE" =~ ^[A-Za-z0-9_.-]+$ ]] || fail "Invalid service name: $TURN_APP_SERVICE"

    umask 077  # both files contain the secret
    cat > "$override" <<EOF
$OVERRIDE_MARKER
services:
  $TURN_APP_SERVICE:
    environment:
      TURN_URLS: "turn:$TURN_HOST:3478?transport=udp,turn:$TURN_HOST:3478?transport=tcp"
      TURN_SECRET: "$TURN_SECRET"
EOF
    {
        cat deploy/coturn/turnserver.conf
        echo "realm=$TURN_HOST"
        echo "static-auth-secret=$TURN_SECRET"
    } > deploy/coturn/turnserver.generated.conf
    # coturn runs as `nobody` inside the container, so the file must be
    # world-readable; the folder stays private to the deploy user on the host.
    chmod 644 deploy/coturn/turnserver.generated.conf
    chmod 700 deploy/coturn

    docker compose -p taberna-coturn -f deploy/coturn/docker-compose.yml up -d --force-recreate
    echo "TURN relay running for $TURN_HOST; app service '$TURN_APP_SERVICE' gets TURN settings via $override."
else
    echo "TURN_SECRET not set: deploying without the TURN relay (voice only works where STUN is enough)."
fi

docker compose down
docker compose up -d
