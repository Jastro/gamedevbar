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

## 1. Secret
On the server: `openssl rand -hex 32`. The same value goes into coturn (`static-auth-secret`) and into the
taberna container (`TURN_SECRET`).

## 2. coturn config
`~/_docker/jacobocaraballo_taberna/turnserver.conf`:

```
listening-port=3478
fingerprint
use-auth-secret
static-auth-secret=PASTE_THE_SECRET_HERE
realm=taberna.d.jacobocaraballo.com
# Relay ports: one per relayed connection side; 200 is plenty for a bar.
min-port=49160
max-port=49360
# Only if the server itself sits behind NAT (OVH servers usually have the public IP on the NIC):
# external-ip=149.202.94.208
no-cli
no-multicast-peers
no-tls
no-dtls
total-quota=200
user-quota=12
stale-nonce=600
log-file=stdout
# Never relay into the server's own/private networks.
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=::1
denied-peer-ip=fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff
denied-peer-ip=fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff
```

## 3. docker compose
In the server's `docker-compose.yml` (it lives on the server, not in this repo), add the service and the
two variables for the taberna container:

```yaml
services:
  coturn:
    image: coturn/coturn:4.6
    restart: unless-stopped
    network_mode: host   # avoids mapping 200 UDP ports through Docker
    volumes:
      - ./turnserver.conf:/etc/coturn/turnserver.conf:ro

  taberna:            # existing service: keep what's there, add these
    environment:
      TURN_URLS: "turn:taberna.d.jacobocaraballo.com:3478?transport=udp,turn:taberna.d.jacobocaraballo.com:3478?transport=tcp"
      TURN_SECRET: "PASTE_THE_SECRET_HERE"
```

Then `docker compose up -d`. The GitHub deploy runs `docker compose down/up` in that folder, so it
keeps working.

## 4. Firewall
Open on the server (and in the OVH network firewall, if it's enabled):
- `3478/udp` and `3478/tcp` (TURN)
- `49160-49360/udp` (relay ports)

With ufw: `ufw allow 3478/udp`, `ufw allow 3478/tcp`, `ufw allow 49160:49360/udp`.

The hostname must resolve to the server directly (no HTTP proxy/CDN in front). `taberna.d.jacobocaraballo.com`
currently points at 149.202.94.208, so it can be reused.

## 5. Check it
1. Get test credentials from the running container:
   `docker compose exec taberna node -e "console.log(require('./server/config').turnCredentials('test'))"`
2. Open https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/, add
   `turn:taberna.d.jacobocaraballo.com:3478` with that username/password, and click *Gather candidates*.
   A `relay` candidate means TURN works. Only `host`/`srflx` means the ports or the secret are wrong.
3. In the game, ⚙️ → *Conexiones de voz* should show `conectado` for every player.

## Optional: TURN over TLS on 443
Some networks block everything except HTTPS. coturn can also listen with TLS (`turns:`) on 5349 or 443,
using the site's certificate. That needs a separate IP or port, since 443 is the web server's. Only worth it
if players still report "sin conexión" with the setup above.
