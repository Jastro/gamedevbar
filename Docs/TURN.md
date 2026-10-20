# TURN relay for voice chat (coturn)

Last updated 2026-10-20.

## Why
Voice audio goes peer to peer (WebRTC). With only STUN, two players on different networks can connect
only when both NATs allow it. Carrier-grade NAT (Digi, O2, mobile data), strict routers and many
work/university networks don't, and the result is no audio. Two tabs on one machine work because they use
local addresses. A TURN server relays the audio for those pairs. Pairs that can connect directly still do;
TURN is only used when needed.

The game server hands each player short-lived TURN credentials in the `init` message (coturn's
`use-auth-secret` / TURN REST scheme: username `<expiry>:<userId>`, password
`base64(HMAC-SHA1(secret, username))`, valid `TURN_TTL_SECONDS`, default 6 h). The shared secret stays on
the server.

## Automatic setup (deploy workflow)
Every deploy (`.github/workflows/deploy.yml`) copies `deploy/` to the server and runs
`deploy/remote-deploy.sh`. When the `TURN_SECRET` repository secret exists, the script:
1. starts coturn as its own compose project, `taberna-coturn` (`deploy/coturn/`, host networking,
   config = `deploy/coturn/turnserver.conf` + realm + secret);
2. writes `docker-compose.override.yml` (or `compose.override.yaml`) next to the server's compose file,
   adding `TURN_URLS` and `TURN_SECRET` to the app service. `docker compose` merges that file
   automatically, and the server's own compose file is never edited;
3. restarts the app as before (`docker compose down` / `up -d`).

Without the secret, the deploy is exactly as before. If something doesn't fit, the script stops **before**
taking the app down and explains why in the Actions log. That happens if the compose file has more than one
service and `TURN_APP_SERVICE` isn't set, if an override file exists that the workflow didn't create, or if
the secret is malformed.

### One-time checklist (repo + server owner)
1. **Secret:** `openssl rand -hex 32`, then add it in GitHub → repo *Settings → Secrets and variables →
   Actions* as secret `TURN_SECRET`.
2. **Optional variables** (same page, *Variables* tab): `TURN_HOST` (default
   `taberna.d.jacobocaraballo.com`; it must resolve straight to the server, with no proxy/CDN in front)
   and `TURN_APP_SERVICE` (only if the server's compose file has more than one service).
3. **Firewall:** open `3478/udp`, `3478/tcp` and `49160-49360/udp` on the server
   (`ufw allow 3478/udp`, `ufw allow 3478/tcp`, `ufw allow 49160:49360/udp`) and in the OVH network
   firewall if it's enabled.
4. Re-run the latest deploy (Actions → *Build and Deploy* → *Re-run*) or push to `main`.

## Manual setup (without the workflow)
Same pieces by hand: copy `deploy/coturn/` to the server, append `realm=<host>` and
`static-auth-secret=<secret>` to a copy named `turnserver.generated.conf` (mode 644, in a folder only the
deploy user can read; coturn runs as `nobody`), and run
`docker compose -p taberna-coturn -f deploy/coturn/docker-compose.yml up -d`. Then add to the app service:

```yaml
    environment:
      TURN_URLS: "turn:<host>:3478?transport=udp,turn:<host>:3478?transport=tcp"
      TURN_SECRET: "<secret>"
```

and open the firewall ports above.

## Check it
1. Get test credentials from the running app container (replace `taberna` with the service name):
   `docker compose exec taberna node -e "console.log(require('./server/config').turnCredentials('test'))"`
   coturn logs: `docker compose -p taberna-coturn logs -f`.
2. Open https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/, add
   `turn:taberna.d.jacobocaraballo.com:3478` with that username/password, and click *Gather candidates*.
   A `relay` candidate means TURN works. Only `host`/`srflx` means the ports or the secret are wrong.
3. In the game, ⚙️ → *Conexiones de voz* should show `conectado` for every player.

## Optional: TURN over TLS on 443
Some networks block everything except HTTPS. coturn can also listen with TLS (`turns:`) on 5349 or 443,
using the site's certificate. That needs a separate IP or port, since 443 is the web server's. Only worth it
if players still report "sin conexión" with the setup above.
