// Server entry: static client over HTTP, game state over WebSocket.
const express = require('express');
const path = require('path');
const http = require('http');
const cors = require('cors');
const { PORT } = require('./config');
const { Hub } = require('./hub/Hub');
const { registerLeaderboards } = require('./features/leaderboards');
const { registerProfiles } = require('./features/profiles');
const { registerPresence } = require('./features/presence');
const { registerDoors } = require('./features/doors');
const { registerSeats } = require('./features/seats');
const { registerChat } = require('./features/chat');
const { registerArcade } = require('./features/arcade');
const { registerDuel } = require('./features/duel');
const { registerSoccer } = require('./features/soccer');
const { registerVoice } = require('./features/voice');
const { registerRadio } = require('./features/radio');
const { registerProjector } = require('./features/projector');
const { registerVircon } = require('./features/vircon');
const { registerLights } = require('./features/lights');
const { registerBathroom } = require('./features/bathroom');
const { registerDrinks } = require('./features/drinks');
const { registerDarts } = require('./features/darts');
const { registerGraffiti } = require('./features/graffiti');
const { registerStickers } = require('./features/stickers');
const { registerPong } = require('./features/pong');
const { registerWeather } = require('./features/weather');
const { registerSlots } = require('./features/slots');
const { registerFoosball } = require('./features/foosball');
const { registerGestures } = require('./features/gestures');
const { registerDriving } = require('./features/driving');
const { registerCar } = require('./features/car');

const DIST_DIR = path.join(__dirname, '..', 'dist');

const app = express();
app.use(cors());
// No automatic `/dir` → `/dir/` redirects: `/gamedev/` is redirected the other
// way below.
app.use(express.static(DIST_DIR, { redirect: false }));
// `/` and the direct links to a bar (`/gamedev`, `/desarrollo`...) are the
// same page; the client reads the room from the path and falls back to the
// start dialog for names it doesn't know. `/gamedev/` redirects to `/gamedev`
// so relative URLs keep resolving from the site root.
app.get(/^\/([a-z0-9_-]{1,32})\/$/i, (req, res) => {
    const query = req.originalUrl.slice(req.path.length);
    res.redirect(301, `/${req.params[0]}${query}`);
});
app.get(/^\/([a-z0-9_-]{1,32})?$/i, (req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));

const server = http.createServer(app);
const hub = new Hub(server);

// Order matters for hooks: join hooks run in this order (the newcomer gets
// door states before chat history); leave hooks run in reverse, so presence
// (userLeft) goes out last.
// First: other features record results in it (hub.leaderboards).
registerLeaderboards(hub);
registerProfiles(hub);
registerPresence(hub);
registerDoors(hub);
registerRadio(hub);
registerProjector(hub);
registerVircon(hub);
registerLights(hub);
registerWeather(hub);
registerBathroom(hub);
registerDrinks(hub);
registerDarts(hub);
registerGraffiti(hub);
registerStickers(hub);
registerCar(hub);
registerSeats(hub);
registerChat(hub);
registerArcade(hub);
registerPong(hub);
registerSlots(hub);
registerFoosball(hub);
registerGestures(hub);
registerDriving(hub);
registerDuel(hub);
registerSoccer(hub);
registerVoice(hub);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
