# Light through doors, local clock, Spain weather, radial menu and gestures: plan

2026-10-22. Borja: light from inside visible from outside through an open door (and the other way
round); the clock shows each player's local time and weather (browser location, his choice); the
outside follows Spain (day/night, and rain/clouds/sun when the peninsula in general has them); right
click opens a radial menu (Emojis / Animaciones) with sexy dance, push-ups, jerking off, kissing,
spitting, cheering and a toast. Each task is pushed to `main` on its own.

## 1. Light through open doors [LOCKED]
- **Read:** `src/rendering/RoomLighting.js`, `src/world/Weather.js`, `src/world/Street.js`, `src/world/Car.js`.
- **Touches:** RoomLighting, Street/Car (their materials can be dimmed), Weather.
- The scene has one ambient + directional light that follows where you are, so a bar seen from the
  night street looks as dark as the street, and the street seen from inside looks as lit as the bar.
- **Outside → in:** two point lights inside each bar that you're not in, following its switches, on
  only while its front door is open.
- **Inside → out:** while you're inside a bar, the street's own materials (ground, sidewalks, fences,
  lamp posts, car) are dimmed to what the sky would light them with.

## 2. Spain weather outside, local clock [LOCKED]
- **Touches:** `server/features/weather.js`, `src/world/Weather.js`, `src/world/WallClock.js`, new
  `src/world/LocalWeather.js`.
- **Outside:** the server asks Open-Meteo for 8 cities across the peninsula in one request; the street
  shows the majority (rain if at least 3 of 8 have it, clouds = average). Day/night stays Madrid's sun.
- **Clock:** your own local time (browser) and your own weather: the browser asks once for your location
  (rounded to ~10 km, cached for a day, fetched straight from Open-Meteo in your browser). Denied or
  unavailable: Canary timezone → Las Palmas, otherwise Madrid.

## 3. Radial menu and gestures [LOCKED]
- **Touches:** new `src/ui/RadialMenu.js`, `src/entities/Gestures.js`, `server/features/gestures.js`;
  `Game` (right click), `Player` (apply after the mixer), `LocalPlayer` (moving cancels).
- **Right click (no drag):** a radial menu at the cursor: 😀 Emojis (the existing panel) and 🕺
  Animaciones (a second ring with the seven gestures).
- **Gestures** are procedural, on the rig's own bones (body, head, floating hands and feet), in avatar
  space so they fit every character: 💃 sexy dance (loops), 💪 push-ups (loops, whole body down),
  ✊ paja (comic, hand pumping at the hips), 😘 kiss (hearts), 💦 spit (droplets), 🙌 cheer, 🍻 toast
  (shows a beer if your hand is empty). Loops stop when you move or after 10 s.
- **Sync:** `playerGesture {gesture}` → everyone else; `playerGestureStop`. Not replayed on join.
