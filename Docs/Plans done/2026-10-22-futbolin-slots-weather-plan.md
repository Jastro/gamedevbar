# Futbolín, slot machine, real time and weather: plan

2026-10-22. Borja: "add futbolin, one slot machine with stupid images (all memes from internet or
videogames), and the realtime in spain and weather outside (no terrace yet)". Each task is pushed to
`main` on its own once it builds and has been checked in the browser.

## 1. Real time and weather [LOCKED]
- **Read:** `src/rendering/RoomLighting.js`, `src/world/Street.js`, `src/rendering/Scene.js`, `src/audio/synth.js`.
- **Touches:** new `server/features/weather.js`, `src/world/Weather.js`, `src/world/WallClock.js`;
  `RoomLighting` (street light follows the sky), `Environment`, `Game`.
- **Weather:** the server asks Open-Meteo (free, no key) for Madrid every 10 min: weather code,
  temperature, cloud cover, wind, today's sunrise/sunset. `weatherState` to all + join snapshot. If the
  request fails, the last state stays (clear sky before the first answer).
- **Time:** Madrid time from the server clock. The sky color follows the real sun (sunrise/sunset with
  twilight), greyer with clouds. Outside, the street is lit by the sky (dark blue at night) and two lamp
  posts light up at night. Inside the bars, lighting stays on their switches.
- **Weather effects (outside only):** rain/drizzle/showers (falling streaks + rain sound, louder
  outside), snow, fog (only while you're outside), thunderstorms (flashes + rumble).
- **Clock:** a sign above the door inside each bar: "21:43 · 🌧️ 14°C · Madrid".

## 2. Slot machine [LOCKED]
- **Touches:** new `server/features/slots.js`, `src/world/SlotMachine.js`, `src/interactions/slotInteraction.js`.
- **Machine** against each bar's left wall. F or click pulls the lever (10 coins); three reels spin and
  stop on the server's result; everyone sees the same spin. One spin at a time per machine.
- **Symbols** drawn in code (emoji + caption, no downloaded images): 🗿 Moai, 🤡 Payaso, 💀 Calavera,
  🐕 "Much wow", 🍄 1UP, 🎂 "The cake is a lie", 📈 Stonks, F "Press F".
  Three of a kind pays by rarity (📈 Stonks is the jackpot); some are jokes (🎂 pays nothing, 💀 takes
  coins). Two of a kind gets your bet back.
- **Coins** per connection on the server: 100 to start; broke → the owner gives you 50 once a minute.

## 3. Futbolín [LOCKED]
- **Touches:** new `server/features/foosball.js`, `server/shared/foosball.json` (layout shared by both
  sides), `src/world/Foosball.js`, `src/world/FoosballSync.js`, interaction.
- **Table** on the left side of each bar. F on one long side joins that team (red / blue). Up to 2 per
  team: alone you move all 4 rods; with a partner, one takes goalie + defense, the other midfield + attack.
- **The server runs the physics** (60 Hz) and sends the state 20 times a second; players send their rod
  positions and kicks. No host on a client, so nobody's connection decides the game.
- **Controls:** the camera locks above the table from your side; W/S (or ↑/↓) slide your rods, Space or
  click kicks, Esc leaves. First to 5 goals; the score shows on the table.

## Deviations (2026-10-22, all three done and pushed)
- **Weather:** the sky changes everywhere (the bars have no roof), but weather effects stay over the
  street. Lamp posts are new (night on the street was too dark without them).
- **Slots:** pairs pay 18 (not "bet back") and triples were doubled, after computing the expected
  return: with the first table you got back 48% and went broke in ~20 spins; now ~88%.
- **Futbolín:** the server steps against real time (Windows timers made it run at ~60% speed), kicks
  sweep 0.16 along the table (otherwise a ball between the two midfield rods was unreachable), and your
  own avatar is hidden while you play (it covered the view).
