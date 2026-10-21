// Server entry: static client over HTTP, game state over WebSocket.
const express = require('express');
const path = require('path');
const http = require('http');
const cors = require('cors');
const { PORT } = require('./config');
const { Hub } = require('./hub/Hub');
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

const DIST_DIR = path.join(__dirname, '..', 'dist');

const app = express();
app.use(cors());
app.use(express.static(DIST_DIR));
app.get('/', (req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));

const server = http.createServer(app);
const hub = new Hub(server);

// Order matters for hooks: join hooks run in this order (the newcomer gets
// door states before chat history); leave hooks run in reverse, so presence
// (userLeft) goes out last.
registerPresence(hub);
registerDoors(hub);
registerRadio(hub);
registerProjector(hub);
registerSeats(hub);
registerChat(hub);
registerArcade(hub);
registerDuel(hub);
registerSoccer(hub);
registerVoice(hub);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
