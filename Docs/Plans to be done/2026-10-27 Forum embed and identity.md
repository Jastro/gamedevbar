# Forum embed and identity (2026-10-27)

Goal: the bar opens inside a panel that a Firefox/Chrome add-on adds to Mediavida thread pages. The panel
knows the thread's subforum (→ which bar), who the user is (their Mediavida name) and whether they're a
mod, and **nobody can pose as someone else**.

Tags: [LOCKED] build it · [PROPOSAL] build unless Borja objects · [OPEN] needs an answer first.
[Cloud] doable and checkable without a browser (server, logic, docs) · [Local] needs the in-app browser
or the add-on loaded.

## The rule everything follows

Anything read in the user's own browser (the page's DOM, the add-on, URL parameters, postMessage) is
**controlled by that user**: they can edit the page, fork the add-on, or talk to our WebSocket with a
script. So:
- what the browser says (username, mod badge) is only a **hint** for the UI;
- **identity and roles are decided on our server**, from something only the real user can produce;
- the add-on holds no secrets and grants nothing.

## Decisions needed

- [PROPOSAL] **Identity source** (step 5): **A**, a token signed by Mediavida. We're in touch with MV's
  admins and they're on board (Borja, 2026-10-27), so we ask them for the endpoint (questions below).
  **B** (a one-time code in the user's MV profile checked by our server) stays as the fallback only: MV
  is behind Cloudflare, our plain requests got 403 and the old scraper needed headless Chromium,
  removed 2026-10-21.
- [OPEN] **Production domain** of the game (needed for `frame-ancestors`, the WebSocket origin list
  and the add-on's iframe URL).
- **The add-on** (Borja, 2026-10-27): it already exists; Chrome and Firefox as far as we know; Manifest
  version unknown; panel position not decided; most likely only inside threads. The rest is in the
  Spanish questions below, for whoever maintains it.
- [OPEN] **Subforum → bar list**: which MV subforums map to Gamedev, Desarrollo, FEDA, Offtopic; the
  rest go to the plaza (or a default bar?).
- [PROPOSAL] Guests stay allowed (as "Invitado NNNN", no ✓), so the bar works before/without linking.

## Steps

### 1. Embed mode in the game [PROPOSAL] [Local]
- `/embed?room=<id>&thread=<id>` (and the same with `?sub=<slug>`, mapped in step 3): compact layout
  for a small panel, a "Entrar a la taberna" click-to-start screen (sound and mic need a click anyway),
  fullscreen button, no start dialog (name comes from identity; guests get one), the customize prompt
  off.
- Loads only when opened (the add-on creates the iframe on click: a 3D game must not start on every
  thread view).
- Storage: inside MV the iframe is third-party, so its cookies are blocked/partitioned depending on the
  browser; localStorage is partitioned per top site but persists. Keep our token there, not in cookies.
- Read: `src/core/Game.js` (start, init), `src/core/PlayerProfile.js`, `src/world/RoomLayout.js`
  (getRoomIdFromPath), `server/index.js` (routes), `index.html` (start dialog, panels).
- Touches: `server/index.js` (route), `index.html`, `src/core/Game.js`, new `src/embed/EmbedMode.js`.

### 2. Embedding security [PROPOSAL] [Cloud]
- `Content-Security-Policy: frame-ancestors 'self' https://www.mediavida.com https://mediavida.com` on
  the game pages: no other site can frame it (clickjacking).
- WebSocket upgrade: reject `Origin`s not in the allowlist (our domain, MV pages that frame us). A
  defense in depth only: scripts outside a browser can fake it.
- `postMessage` bridge (`src/embed/EmbedBridge.js`): accept only from `window.parent` with
  `event.origin` = Mediavida; always send with an explicit target origin, never `*`; messages are
  hints (`{type: 'mv-context', subforum, thread, usernameHint}`), never trusted for identity.
- Read: `server/index.js`, `server/hub/Hub.js` (handleConnection). Touches: `server/index.js`,
  `server/hub/Hub.js`, `server/config.js` (allowed origins), new `src/embed/EmbedBridge.js`.

### 3. Subforum → bar [PROPOSAL] [Cloud]
- `server/shared/subforums.json`: MV subforum slug (from the thread URL `/foro/<slug>/...`) → room id;
  unknown → plaza/default. Shared by client and server like `foosball.json`.
- Read: `src/world/RoomLayout.js`, `server/config.js` (ROOM_IDS). Touches: new
  `server/shared/subforums.json`, `src/embed/EmbedMode.js`.

### 4. The server owns names [LOCKED] [Cloud]
Today any client can send `setUsername` with any name. Change:
- first message `auth { token? }`: with a valid token the connection gets that **verified** name; without,
  a guest name (`Invitado NNNN`) the client may change, but never to a verified user's name (reserved,
  case/accents/lookalikes normalized) and never with ✓/🛡️ in it;
- ✓ for verified, 🛡️ for mods: badges set by the server in `userJoined`/`userUsername`, drawn by the
  name tag; the 👤 nick field only for guests;
- tokens: random 256-bit, stored **hashed** in `DATA_DIR/identities.json` with name, role, created,
  last seen; expire after N days unused; revocable (admin command);
- rate limits on `auth` and on step 5's verification.
- Read: `server/features/presence.js`, `server/validation.js`, `server/hub/Hub.js`,
  `src/network/WebSocketManager.js`, `src/entities/Player.js` (setUsername, name sprite),
  `src/ui/CustomizeUI.js`. Touches: those, new `server/features/identity.js`, `Docs/Protocol.md`.

### 5A. Identity from a Mediavida-signed token [PROPOSAL: needs the endpoint from MV's admins] [Cloud]
- MV adds `GET /api/taberna-token` (their session cookie): returns a short-lived (≈5 min) token signed
  with **their** key (Ed25519 or ES256 JWT): `{ sub: mvUserId, name, mod: [subforums], aud: 'taberna',
  exp }`.
- The add-on fetches it from mediavida.com (same site: the user's session goes along, we never see
  their cookie) and passes it to the iframe; the iframe sends it to our server, which checks signature,
  `aud`, `exp`, and swaps it for our own token (step 4). Mod status comes from the token: trustworthy.
- Read: step 4's files. Touches: `server/features/identity.js`, `server/config.js` (MV public key).

### 5B. Identity by a code in the MV profile [OPEN: spike first] [Cloud]
- **Spike**: can our server fetch `https://www.mediavida.com/id/<user>` reliably (Cloudflare)? If only
  a headless browser can, stop and push for 5A.
- Flow: in the bar, "Vincular cuenta de Mediavida" → server gives a code (`TABERNA-XXXXXX`, bound to the
  claimed name, valid 10 min) → user pastes it in their profile → "Comprobar" → server fetches the
  profile, finds the code → issues our token → user can delete the code.
- Mods: an allowlist in `DATA_DIR/roles.json` (name → role), edited by us; the DOM's mod badge is only
  a hint.
- Read: step 4's files. Touches: `server/features/identity.js`, new UI panel in `src/ui/`.

### 6. Roles and mod tools [PROPOSAL] [Cloud]
- Server-side checks only: mute (chat/voice) for N minutes, kick, temporary ban (by verified name);
  every action logged (`DATA_DIR/modlog.jsonl`); mods can't act on other mods.
- UI: in the profile card (click an avatar) for mods.
- Read: `server/features/chat.js`, `server/features/voice.js`, `server/features/profiles.js`,
  `src/ui/ProfileUI.js`. Touches: those, new `server/features/moderation.js`.

### 7. The add-on [OPEN: its maintainer's answers] [Local]
- Manifest V3 (Chrome and Firefox), one content script on `https://www.mediavida.com/foro/*`, host
  permission for mediavida.com only, no remote code, no cookies/tabs permissions.
- Adds a dockable panel; on open creates the iframe
  `https://<domain>/embed?sub=<slug>&thread=<id>` with `allow="microphone; fullscreen; autoplay"`;
  answers the iframe's `ready` with `{subforum, thread, usernameHint}`; with 5A, also fetches and passes
  the MV token.
- Remembers panel state (open, size, side) in extension storage.

### 8. Docs and checks [LOCKED]
- `Docs/Embed.md` (how it fits together, the threat model, the add-on contract), Protocol (`auth`,
  badges), Systems, HANDOVER, PendingUserChecks (log in, impersonation attempts fail, mod tools).

## Open questions (in Spanish, to forward)

Already answered (Borja, 2026-10-27): the add-on exists; Chrome and Firefox; most likely only inside
threads; we're in touch with MV's admins and they're fine with it.

### Para quien mantiene la extensión
1. ¿Quién la mantiene y la publica en las tiendas de Chrome y Firefox? ¿Podemos añadirle código nosotros
   o se lo pedimos a esa persona?
2. ¿Usa Manifest V3 o V2? (Chrome ya solo acepta V3).
3. ¿Dónde irá el panel (acoplado a un lado, abajo, flotante) y con qué tamaño? ¿Se puede redimensionar,
   ponerse a pantalla completa o minimizar?
4. ¿En qué páginas aparece: solo dentro de los hilos (`/foro/<subforo>/<hilo>`) o también en los
   índices de subforo y la portada?
5. ¿Cómo saca ahora el nombre de usuario y si es moderador? ¿De qué elementos de la página? (Para
   nosotros solo será una pista para la interfaz: la identidad la decide el servidor).
6. ¿Crea el iframe del juego directamente en la página del foro, o carga una página propia de la
   extensión que lo contiene?
7. ¿Habla con algún servidor propio o guarda datos (ajustes, sesión…)?
8. ¿Puede añadir al iframe `allow="microphone; fullscreen; autoplay"` y crearlo solo cuando el usuario
   abre el panel (no en cada carga de hilo)?

### Para los admins de Mediavida (paso 5A)
1. ¿Pueden añadir un endpoint, p. ej. `GET /api/taberna-token`, que con la sesión normal del usuario
   devuelva un token corto (≈5 min) firmado con una clave suya (Ed25519 o un JWT ES256)?
2. Contenido del token: id de usuario, nombre, de qué subforos es moderador (o si es admin), `aud`
   (`taberna`) y caducidad. ¿Les falta o sobra algo?
3. ¿Nos pasan la clave pública para verificar la firma? ¿Cómo la rotaríamos si hiciera falta?
4. ¿Debe poder llamarlo la extensión desde la página del foro (misma web, va la cookie de sesión)? ¿Hay
   que limitarlo por `Origin`?
5. ¿Qué subforos van a cada bar (Gamedev, Desarrollo, FEDA, Offtopic) y qué hacemos con el resto (la
   plaza o un bar por defecto)?
6. ¿Algún límite o norma que debamos respetar (peticiones, datos que podemos guardar, avisos de
   privacidad para el micro y la voz)?
