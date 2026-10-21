# Appearance, part 1: accessories, color, size, name color

2026-10-21. Borja: "as many as you can, you decide how; bar and videogame themed". Branch/PR:
`feature/appearance`.

## Steps (one PR each)
1. **This PR** [LOCKED]:
   - an appearance object `{ head, face, hand, tint, scale, nameColor }`, saved in `PlayerProfile`,
     sent with `setUsername` and validated by the server (format only: ids, hex colors, scale 0.85-1.15);
   - about 24 accessories built from Three.js primitives (no assets, no licenses), in three slots:
     head (hats), face (glasses etc.) and right hand (drinks, a gamepad...);
   - a color tint, a size slider, name colors;
   - the 👤 menu gets tabs: Personaje / Accesorios / Color.
2. **Next** [PROPOSAL]: more characters (same rig, once the asset pack and its license are identified),
   and per-part colors.
3. **Later** [OPEN]: unlocks/badges, once forum login and server persistence exist.

## How
- `src/appearance/items.js`: the builders. Sizes are in avatar space (a head is ~0.92 wide, the skull top
  is ~0.53 above the avatar's center).
- `src/appearance/catalog.js`: slots, items (id, Spanish name, emoji, slot), tints and name colors.
- `src/appearance/Accessories.js`: per-model anchors (Head bone for head/face, HandR for hand), computed
  in bone space at load time in the rest pose and cached, so items follow the animations. Also applies
  the tint (material color) and the scale (model scale; feet stay on the ground).
- `Player`: `setAppearance(appearance)`, re-applied after every model load. Name tag uses `nameColor`.
- **Server:** `cleanAppearance` in `server/validation.js`; `User.appearance` is sent in `userJoined` and
  `userUsername`.
