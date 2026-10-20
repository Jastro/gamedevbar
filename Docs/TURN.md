# TURN relay for voice chat (coturn)

Last updated 2026-10-21.

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

## Setup (git-ops stacks on the server)
The relay and the app's TURN settings live in the server owner's git-ops repo (Portainer stacks), not in
this repo. This repo only builds the image (`.github/workflows/deploy.yml` → `ghcr.io/jastro/gamedevbar`)
and calls the `taberna` stack's Portainer webhook.
- `coturn` stack: coturn with host networking, `use-auth-secret`, relay ports 49160-49360, relaying into
  private/internal networks denied. Variable `TURN_SECRET`.
- `taberna` stack: the app, with `TURN_URLS` built from `TURN_HOST` (default
  `taberna.d.jacobocaraballo.com`, must resolve straight to the server, no proxy) and the **same**
  `TURN_SECRET`. Without it the app runs with STUN only.

### One-time checklist (server owner)
1. **Secret:** `openssl rand -hex 32`; set it as `TURN_SECRET` in both stacks.
2. **Firewall:** open `3478/udp`, `3478/tcp` and `49160-49360/udp` on the server
   (`ufw allow 3478/udp`, `ufw allow 3478/tcp`, `ufw allow 49160:49360/udp`) and in the OVH network
   firewall if it's enabled.
3. **GitHub:** repo secret `PORTAINER_WEBHOOK_URL` (the `taberna` stack's webhook); after the first
   build, make the `gamedevbar` package public (GitHub → Packages → Package settings) so Portainer can
   pull it without credentials.

## Check it
1. Get test credentials from the running app container:
   `docker exec taberna-app node -e "console.log(require('./server/config').turnCredentials('test'))"`
   coturn logs: `docker logs -f coturn`.
2. Open https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/, add
   `turn:taberna.d.jacobocaraballo.com:3478` with that username/password, and click *Gather candidates*.
   A `relay` candidate means TURN works. Only `host`/`srflx` means the ports or the secret are wrong.
3. In the game, ⚙️ → *Conexiones de voz* should show `conectado` for every player.

## Optional: TURN over TLS on 443
Some networks block everything except HTTPS. coturn can also listen with TLS (`turns:`) on 5349 or 443,
using the site's certificate. That needs a separate IP or port, since 443 is the web server's. Only worth it
if players still report "sin conexión" with the setup above.
