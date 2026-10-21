# Direct join links + in-game customization (design)

2026-10-21. Status: approved 2026-10-21, built (plan `2026-10-21-direct-join-plan.md`). Branch/PR of its own (`feature/direct-join`).

## Why
The bar is going to be embedded in Mediavida threads, one bar per subforum. An embed can't open with a
three-step setup dialog: whoever clicks in should be standing in the bar a few seconds later. Later the
forum will hand us the username; until then the player picks their own nick, but only from inside the bar.

## What Borja decided
- **Two ways in.**
  - The current link (`/`) keeps the current start dialog exactly as it is: nick, character, bar,
    *Entrar al Bar*.
  - A new link per bar, `/<roomId>` (today `/gamedev` and `/desarrollo`), skips the dialog.
- **Direct link flow:** a loading image, then straight into that bar.
- **First visit on a browser through a direct link:**
  - random character, saved for next time;
  - placeholder nick `Parroquiano NNNN` (4 random digits), saved for next time;
  - once in the bar, a popup *¿Quieres personalizar tu personaje?* with *Sí* / *No*.
    - *No* closes it.
    - *Sí* opens the customization menu.
    - The popup shows only on the first visit (per browser) and never again after either answer.
- **Customization menu** (Spanish UI):
  - character picker plus a nick field, applied live (others see the new look and name);
  - stays reachable afterwards from a button in the HUD.
- **Nick field is temporary.** When forum usernames arrive, the nick comes from the forum and the field is
  removed; only the look stays customizable. That integration is not part of this work.

## Goals
- `/<roomId>` → in the bar with no clicks, on desktop and phone width.
- The menu works the same whichever way you came in, including the classic `/` flow.
- Name and character changes reach everyone live and survive a reload.

## Non-goals
- Forum login/username, embed-specific layout (`?embed=1`), postMessage API: later work.
- Switching bar from the menu: you walk across the street.
- Server-side room membership: rooms stay client-side as today.

## Anti-goals (a failure even if it technically works)
- Any extra screen, click or text field before you're in the bar on a direct link.
- The classic `/` flow changing.
- The popup coming back on every visit.

## Constraints and what already exists
- The protocol already supports live changes. `setUsername {username, selectedModel}` → server
  (`server/features/presence.js`) cleans both → `userUsername` broadcast to everyone, including you.
  `PlayerManager.handleUserUpdate` already applies the name and model.
- `ModelSelector.notifyModelChange` already sends `setUsername` when a local player exists.
- `server/validation.js` `cleanUsername` clamps the length; `cleanModelId` accepts `pj`…`pj6`.
- Character options are the six `.model-option` elements (`pj`…`pj6`) in `index.html`'s start dialog.
  `ModelSelector.init()` creates one WebGL preview renderer per option.
  - A direct join must not create these six contexts up front. Create the previews when the menu first
    opens. The previews matter on phones.
- Remembered state today:
  - `localStorage.selectedModel` (ModelSelector);
  - `localStorage.selectedRoom` (RoomSelector);
  - the nick isn't saved yet.
- Production: `server/index.js` serves `dist/` statically and `index.html` only for `/`. Vite dev already
  falls back to `index.html` for unknown paths. Client asset URLs are absolute (`/vircon32/...`,
  `/assets/...`), so a page served at `/gamedev` loads them fine.
- UI strings in Spanish, code and comments in US English.

## Builder's calls (made by Claude, not discussed with Borja)
- **Routing.**
  - Server: one route per room id from a shared list, sending `index.html`.
  - Client: read the room from `location.pathname`.
  - Unknown paths (`/foo`) show the classic dialog.
  - A trailing slash and letter case are tolerated (`/Gamedev/` works).
- **Shared nick memory.** The classic dialog also saves the nick and pre-fills it next time, so both ways
  in share one remembered nick and character.
- **Popup memory.** The popup flag is a localStorage key. Returning players who already have a saved
  character or nick from the classic flow still see it once.
- **Loading image.** A full-screen overlay with the bar's name and *Cargando la taberna…*. It's removed
  once the local avatar is in the scene; no progress bar.
- **HUD button:** 👤 next to ⚙️, title *Personalizar personaje*.
- **Menu layout.** A `FloatingPanel` like the radio and Vircon32 panels:
  - nick input;
  - the six character tiles with previews;
  - *Guardar*.
  - The character applies on click; the nick on *Guardar* or Enter. An empty nick is ignored.
- **Forum seam.** One function decides the identity on a direct join: saved nick, else placeholder. The
  forum username will plug in there and hide the nick field.
- **Entry code.** `Game.start` keeps its `{ username, roomId }` input; the direct path builds that object
  instead of `StartScreen`.
- **Sound without a click.** With no *Entrar al Bar* click, the browser keeps audio suspended until the
  first interaction.
  - Resume the audio context (and kick the radios and projector) silently on the first `pointerdown` or
    `keydown`. No "tap for sound" hint, since that would be the extra click the anti-goals forbid.
  - On a first visit, the popup's *Sí*/*No* click is that interaction.
- **Inside an iframe later.** In a cross-site iframe, browsers partition `localStorage` (Safari also
  expires it), so "remembered" would silently become "per forum visit".
  - Acceptable for now. Forum identity will replace the nick, and the character can move to the server
    then.
  - Keep all of this state behind one small module, so moving it later is one change.
- **Git.** Branch `feature/direct-join` → PR to `Jastro/gamedevbar`, as with PRs #10-#17. Each commit must
  be shippable, since merging deploys.

## Done looks like
- `/gamedev` and `/desarrollo` drop a fresh browser into the right bar with a random character, a
  `Parroquiano NNNN` nick and the popup.
- After a reload: same character and nick, no popup.
- 👤 opens the menu. A second client sees name and character changes live.
- `/` behaves as before, pre-filled with the remembered nick.
- `npm run build` passes. `Docs/Architecture.md` (entry flow), `Docs/Systems.md` and
  `Docs/PendingUserChecks.md` are updated in the same PR.
