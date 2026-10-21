# Chairs, jump, Enter, Pokebonk cabinet, the smoke car: plan

2026-10-21. Borja's request. Answers: car passengers each land somewhere random; the smoke starts after
a 5 s countdown once 2+ are inside. Branch/PR: `feature/car-pokebonk`.

## Tasks
1. **Small fixes.**
   - Chairs turned −90° (they faced sideways).
   - Shorter, faster jump: `JUMP_SPEED` 10, `GRAVITY` −33, so ~1.5 high and ~0.6 s in the air (tables at
     1.0 stay reachable).
   - Enter focuses the chat when you aren't typing.
   - The ❔ list is updated.
2. **Pokebonk cabinet.**
   - The Vircon32 moves to x 12.5; a second web cabinet goes at x 8.8 on the back wall.
   - `WebGameCabinet` plays https://pokebonk.com/ in a cross-origin iframe on its screen (CSS3D + hole,
     like the Vircon32).
   - **Occupancy** (one player): through the server's existing Vircon32 cabinet logic, under a separate
     key (`roomId` + `:pokebonk`), so no new server feature is needed.
   - **Play mode:** camera locked; the canvas lets clicks through to the iframe; the iframe gets focus.
   - **Leaving:** an on-screen *✕ Salir* button (Esc can't reach us from a cross-origin frame), plus Esc
     when the page has focus.
   - **Not watchable:** another site's canvas can't be captured.
   - **If the site doesn't load:** a message in chat plus a link to open it in a new tab.
3. **Smoke car.**
   - **Model:** a black car on the street with 5 seats (`carSeat`, click or F, with ids `car:0`…`car:4`).
   - **Server** (`server/features/car.js`):
     - seat occupancy: `carSit {slot}` / `carLeave` → `carState {slots}`, plus a snapshot on join;
     - with 2+ inside, a 5 s countdown (`carCountdown {endsAt}`, cancelled below 2), then
       `carSmoke {occupants}`;
     - the slots are cleared after the ride.
   - **Client:**
     - everyone sees smoke particles inside the car and hears a synthesized "fsss" hiss (positional);
     - passengers fade to black after ~3 s, are teleported to a random free spot (a random bar or the
       street, checked with the collision system), stand up and fade back in.
     - Leaving the car with WASD sends `carLeave`; disconnecting frees the seat.
4. **Docs, verification, PR.**

## Deviations (2026-10-21)
- **Getting in:** the car is one click target (the body hides the seats), and the server picks the free
  seat.
- **Seats:** they are cleared when the smoke starts, not after the ride.
- **Pokebonk focus:** clicking outside it hands the keyboard back to the bar (V, R, Esc).
