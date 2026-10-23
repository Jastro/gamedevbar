// Bathroom graffiti: line segments per wall (four per bathroom, id
// `<roomId>:<0-3>`), relayed to everyone and kept
// (in memory only) so late joiners see the wall. A segment is
// [x0, y0, x1, y1, color, size], coordinates 0..1 (see src/world/GraffitiWall.js).
const { isRoomId } = require('../config');

const MAX_SEGMENTS = 3000;  // per wall; the oldest go first
const MAX_BATCH = 60;       // segments per message
const MIN_INTERVAL_MS = 40; // per user between messages
const COLORS = 7;           // 6 colors + the eraser
const SIZES = 3;
const WALLS = 4;            // per bathroom (src/world/GraffitiWall.js WALLS)

function isWallId(wallId) {
    if (typeof wallId !== 'string') return false;
    const [roomId, index, extra] = wallId.split(':');
    return extra === undefined && isRoomId(roomId) && /^\d$/.test(index ?? '') && Number(index) < WALLS;
}

const unit = (value) => typeof value === 'number' && value >= 0 && value <= 1;

function cleanSegment(segment) {
    if (!Array.isArray(segment) || segment.length !== 6) return null;
    const [x0, y0, x1, y1, color, size] = segment;
    if (![x0, y0, x1, y1].every(unit)) return null;
    if (!Number.isInteger(color) || color < 0 || color >= COLORS) return null;
    if (!Number.isInteger(size) || size < 0 || size >= SIZES) return null;
    const round = (value) => Math.round(value * 1000) / 1000;
    return [round(x0), round(y0), round(x1), round(y1), color, size];
}

function registerGraffiti(hub) {
    const walls = new Map(); // wallId -> segments

    hub.on('graffitiDraw', ({ ws, user }, { wallId, segments }) => {
        if (!isWallId(wallId)) return;
        if (!Array.isArray(segments) || segments.length === 0 || segments.length > MAX_BATCH) return;
        const now = Date.now();
        if (now - (user.lastGraffiti ?? 0) < MIN_INTERVAL_MS) return;
        user.lastGraffiti = now;
        if (!walls.has(wallId)) walls.set(wallId, []);
        const clean = segments.map(cleanSegment).filter(Boolean);
        if (clean.length === 0) return;
        const wall = walls.get(wallId);
        wall.push(...clean);
        if (wall.length > MAX_SEGMENTS) wall.splice(0, wall.length - MAX_SEGMENTS);
        hub.broadcast({ type: 'graffitiDraw', wallId, segments: clean }, ws);
    });

    hub.onJoin(({ ws }) => {
        hub.send(ws, { type: 'graffitiStates', walls: Object.fromEntries(walls) });
    });
}

module.exports = { registerGraffiti };
