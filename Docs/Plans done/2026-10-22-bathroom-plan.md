# Bathroom: plan

2026-10-22. Borja's request, with answers:
- **Where:** the front-left corner of each bar.
- **Stink:** it stays in the bathroom for 10 min after a number 2, and an air freshener clears it.
- **Shame:** the dirty-hands mark lasts until you wash at a sink (10 min at most).

Branch `feature/bathroom` on Jastro/gamedevbar, then a PR. I merge after Borja's OK.

## Layout (room-local, built per room)
- **Cubicle:** x -15..-10, z 5..10, so about 4.8 × 4.8 inside (3+ people). Partitions are 3.2 m high with
  no roof, so the camera works and the bar's paintings above stay visible.
- **Door:** in the z = 5 partition (gap x -11.9..-10.7). It swings, with a blocker while closed and a
  🟢 Libre / 🔴 Ocupado sign outside. A latch knob inside: while latched, only the person who latched it
  can open it.
- **Fixtures:**
  - toilet against the left wall (x -14.4, z 8.6), facing the room, with a flush handle on the tank;
  - sink on the front wall (x -12.2) with a mirror above (`Reflector`, rendered only while you're inside);
  - air freshener on a shelf;
  - a ceiling lamp plus its own light switch inside, by the door;
  - a toilet paper roll.
- **Leftover:** the empty "Bathroom" group in `level.json` (an invisible seat by the Vircon32) is removed in
  `Scene.load`.

## Behavior
- **Toilet:** F or click → *💧 Pis* / *💩 Caca*.
  - Pee: you stand in front facing the bowl, a trickle sound plays, and the bowl shows yellow water.
  - Poo: you sit, there's a fart (`cacota1-4.mp3`) plus a plop, a 💩 appears in the bowl, and the stink
    cloud (green haze and flies) lasts 10 min.
  - Either way your hands are dirty.
- **Flush** (the handle): a whoosh, the bowl content swirls away, and it's clean.
- **Sink:** water sound; your hands are clean.
- **Air freshener:** a spray sound and particles; the stink is gone.
- **Shame:** dirty hands outside a bathroom show wavy green smell lines around your hands and a
  "🤢 No se ha lavado las manos" tag above your head, for everyone, until you wash or 10 min pass.
- **Light:** the cubicle's own lamp. While you're inside, the scene lighting follows the cubicle's switch
  (on = normal, off = dark).

## Server (`server/features/bathroom.js`, per room)
- **State:** `{ doorOpen, latchedBy, lightOn, mess: null|'pee'|'poo', stinkUntil, occupant }`, plus each
  user's `dirtyHands` (cleared after 10 min).
- **Messages:** `bathroomDoor`, `bathroomLatch`, `bathroomLight`, `toiletUse {kind}`, `toiletLeave`,
  `toiletFlush`, `washHands`, `airFreshener` → `bathroomState` / `bathroomEvent {kind}` / `hygiene` to all;
  snapshots on join.
- **Rules:** a latched door refuses others; the toilet refuses a second user while occupied.
  Disconnecting frees the latch and the toilet.

## Interaction API
Interactions get an optional `canReach(object, position)`, so fixtures inside the cubicle only work from
inside it (a light switch 0.5 m away through the partition must not).

## Verification
Two in-app clients:
- the door and latch sync, and a latched door refuses the other player;
- pee and poo show the right visuals and sounds, flush clears the bowl, the stink lasts and the
  freshener clears it;
- shame shows after leaving without washing and clears at the sink;
- the light syncs, and the mirror renders only while inside.

## Deviations (2026-10-22)
- **Latch and door:** from inside, anyone can open or unlatch (no one can be trapped), and latching
  requires being inside.
- **Cooldowns:** per user on every action.
- **Lamp:** it only lights while the local player is inside.
- **Doorway:** the door does not close or latch on someone standing in the doorway.
- **Seated clicks:** they do nothing (like F).
