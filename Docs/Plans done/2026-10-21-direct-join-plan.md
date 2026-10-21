# Direct join links + customization menu: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Borja chose unattended
> inline execution, 2026-10-21). Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** `/<roomId>` drops you into that bar with no setup. A 👤 menu changes nick and character live.

**Architecture:**
- A small `PlayerProfile` module owns the remembered identity (nick, model, popup flag).
- `Game` picks the entry path from `location.pathname`: the classic `StartScreen` or a direct start.
- `CustomizeUI` (a `FloatingPanel`) reuses the start dialog's `.model-selector` node and ModelSelector
  previews, created lazily. Live changes go through the existing `setUsername` → `userUsername` messages.

**Tech stack:** vanilla JS (Vite), Three.js r160, Express.

**Spec:** `Docs/Plans to be done/2026-10-21-direct-join-design.md`

## Global constraints
- UI strings in Spanish, code and comments in US English.
- Placeholder nick `Parroquiano NNNN` (4 random digits). Nick input `maxlength` 15, as in the start dialog.
- Model ids `pj`, `pj2` … `pj6`.
- Existing storage keys stay: `selectedModel`, `selectedRoom`. New keys: `playerName`, `customizePromptSeen`.
- `/` keeps the classic dialog unchanged, apart from the nick being pre-filled.
- No new dependencies. There's no test runner: verify with `npm run build` and two in-app browser
  clients (logged in HANDOVER).

## Review focus
1. **Storage blocked (private mode):** the direct join must still work, with a placeholder and a random
   model every time, and no exceptions. Check: run with `localStorage` access throwing.
2. **Sound before any click on a direct join:** after the first `pointerdown`/`keydown`,
   `AudioContext.state` becomes `running` and the radio plays.
3. **An empty or whitespace nick in the menu** is ignored, so the old nick stays.
4. **Path variants:** `/Gamedev/` and `/desarrollo` work, `/foo` shows the classic dialog, and
   `/vircon32/index.html` and `/assets/...` still serve files.
5. **Opening the menu twice** must not create a second set of preview WebGL renderers.

---

### Task 1: PlayerProfile + classic flow uses it
**Files:** create `src/core/PlayerProfile.js`; modify `src/ui/StartScreen.js`, `src/ui/ModelSelector.js`.

**Interfaces (produced):**
- `MODEL_IDS: string[]`
- `loadProfile(): { name: string|null, model: string|null }`
- `saveName(name)`, `saveModel(modelId)`
- `randomModel(): string`
- `placeholderName(): string`
- `hasSeenCustomizePrompt(): boolean`, `markCustomizePromptSeen()`

Every storage access goes through try/catch.

- [x] `PlayerProfile.js` with the API above.
  - `placeholderName()` returns `` `Parroquiano ${1000 + random 0..8999}` ``.
  - `loadProfile().model` is only returned when it's in `MODEL_IDS`.
- [x] ModelSelector stores the model through `saveModel`, replacing the raw `localStorage.setItem`.
- [x] StartScreen: pre-fill `usernameInput` from `loadProfile().name`, and `saveName(username)` in
  `start()`.
- [x] `npm run build` passes, then commit.

### Task 2: Direct entry (route, loading overlay, audio resume)
**Files:**
- modify `server/index.js`, `src/core/Game.js`, `index.html`, `src/world/RoomLayout.js`, `src/ui/ModelSelector.js`;
- create `src/ui/LoadingScreen.js`.

**Interfaces:**
- **Produced:**
  - `getRoomIdFromPath(pathname): string|null` in `RoomLayout.js`: trims slashes, lowercases, returns the
    id if it's in `ROOMS`.
  - `ModelSelector.setSelectedModel(modelId)`: sets `selectedModel`, resolves the pending promise, and
    marks the tile if the DOM is initialized.
  - `Game.directJoin: boolean`.
- **Consumed:** everything from Task 1.

- [x] **Server:** after `express.static`, add
  `app.get(/^\/[a-z0-9_-]{1,32}\/?$/i, sendFile(index.html))`, replacing the `/`-only route. Keep `/`.
- [x] **Game constructor:** set `const roomId = getRoomIdFromPath(location.pathname)`.
  - **Room id found:**
    1. hide `#username-dialog`;
    2. show the loading screen;
    3. set the model with `loadProfile().model ?? randomModel()`, then `saveModel` it, and
       `setSelectedModel` it;
    4. resolve the name with `loadProfile().name ?? placeholderName()`, then `saveName` it;
    5. show the chat UI as `StartScreen.start` does;
    6. call `this.start({ username, roomId })`.
  - **No room id:** use the existing StartScreen.
  - Don't call `ModelSelector.init()` on the direct path.
- [x] **`LoadingScreen`:** a full-screen overlay showing the bar's `name` and *Cargando la taberna…*, with the
  same look as the dialog. `hide()` runs once the local player's model has loaded, using the
  `setModel(...).then` in `PlayerManager.handleInit`. Expose the hook as a `game.onLocalPlayerReady`
  callback or an event.
- [x] **Audio resume:** in `Game.setupInput`, a one-shot `pointerdown`/`keydown` listener calls
  `listener.context.resume()` and kicks the radios. Check that `Radio` restarts once the context runs, and
  add a `resume` hook if it doesn't.
- [x] **Verify:**
  - `/gamedev` in a fresh profile spawns in Gamedev with a placeholder nick;
  - `/desarrollo` spawns in Desarrollo;
  - `/foo` shows the dialog;
  - `/` shows the dialog with the nick pre-filled.
- [x] `npm run build`, then commit.

### Task 3: Customization menu + first-visit popup
**Files:** create `src/ui/CustomizeUI.js`; modify `src/core/Game.js`, `src/ui/ModelSelector.js`, `index.html`
(CSS).

**Interfaces:**
- **Produced:** `CustomizeUI` with `open()`, `close()`, and `maybeAskOnFirstVisit()`.
- **Consumed:** `game.network.send('setUsername', {username, selectedModel})`, `game.username`, the
  ModelSelector.

- [x] **👤 button:** `#customize-button` in `#chat-container` next to ⚙️, styled like
  `#voice-settings-button` and placed to its left (with the phone layout too). Title
  *Personalizar personaje*.
- [x] **Panel:** a `FloatingPanel('customize-panel', '👤 Personaliza tu personaje')`.
  - Body contents:
    - label *Tu nombre*;
    - an input (maxlength 15);
    - a *Guardar* button;
    - the existing `.model-selector` node, moved out of the dialog on first open.
  - On first open, call `ModelSelector.init()` once (it's guarded by an `initialized` flag), so the previews
    are created while visible.
  - Previews are paused while the panel is closed: `ModelSelector.setPreviewsActive(bool)` gates the
    rAF loops.
- [x] **Applying changes:**
  - A model click goes through ModelSelector's change callback:
    1. `localPlayer.setModel(id)`;
    2. `saveModel`;
    3. send `setUsername` with the current name.
  - *Guardar* or Enter with a non-empty trimmed nick:
    1. `game.username = nick`;
    2. `saveName`;
    3. send `setUsername`;
    4. a chat system line *Ahora te llamas X*.
  - Remove ModelSelector's dead `this.game` branch.
  - Typing in the input must not move the player (`chatActive` already covers INPUT).
- [x] **Popup:** on a direct join only, once the avatar has loaded, if `!hasSeenCustomizePrompt()`:
  - a small centered dialog *¿Quieres personalizar tu personaje?* with *Sí* / *No*;
  - both buttons call `markCustomizePromptSeen()`; *Sí* also opens the panel.
- [x] **Verify with two in-app clients:**
  - B sees A's model and name change live;
  - after a reload there's no popup and the nick and model are kept;
  - the panel opened twice still has 6 canvases in total.
- [x] `npm run build`, then commit.

### Task 4: Docs, final verification, PR
- [x] Update the docs:
  - `Docs/Architecture.md`: the entry flow, plus a line on `PlayerProfile`/`CustomizeUI`;
  - `Docs/Systems.md`: a section on direct links and customization;
  - `Docs/PendingUserChecks.md`: direct link on a phone, popup feel, menu layout;
  - `HANDOVER.md`: a Done entry and Decisions to review.
- [x] Move the design and this plan to `Docs/Plans done/`, adding a *Deviations* note if any.
- [x] Push `feature/direct-join` to `fork`, then open a PR to `Jastro/gamedevbar` main. Stop the dev
  servers.

## Deviations (2026-10-21)
- **Phone/tablet layout (bug fix).** Below ~900 px the 😊/🎙️/⚙️ buttons were already off-screen, and 👤
  would have been too. They now sit in a row above the chat input, and the chat log moves up to make room.
  Found while placing 👤, and done here because embeds will often be narrow.
- **Previews pause in the classic flow too.** The classic dialog's previews now stop rendering after
  *Entrar al Bar*; before, six render loops ran for the whole session.
- **Removed dead code.** ModelSelector's unused `this.game` branch is gone; CustomizeUI applies changes
  instead.
