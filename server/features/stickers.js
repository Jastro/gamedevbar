// Stickers (src/world/StickerSync.js): one per person, stuck where they
// aimed. A new one replaces your previous one (at most one every 10 s), and
// each goes after 24 h. "You" is a random key your browser keeps (never sent
// to anyone else), so a reconnect still replaces your old sticker. Kept in
// memory only: a restart (every deploy) wipes them.
const { ids: STICKER_IDS } = require('../shared/stickers.json');

const COOLDOWN_MS = 10 * 1000;
const LIFETIME_MS = 24 * 60 * 60 * 1000;
const MAX_STICKERS = 300;   // in total; the oldest go first
const WORLD_LIMIT = 200;    // |x|, |z|
const HEIGHT_LIMIT = 30;    // |y|
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,40}$/;

const finite = (value, limit) => (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit ? value : null);

// A direction as a unit vector, or null.
function unit(x, y, z) {
    const values = [x, y, z].map(value => finite(value, 10));
    if (values.includes(null)) return null;
    const length = Math.hypot(...values);
    if (length < 0.5) return null;
    return values.map(value => Math.round((value / length) * 1000) / 1000);
}

function registerStickers(hub) {
    const stickers = new Map(); // owner key -> sticker
    const lastPlaced = new Map(); // owner key -> ms
    let nextId = 1;

    const publicSticker = ({ id, stickerId, position, normal, up }) => ({ id, stickerId, position, normal, up });

    const remove = (key) => {
        const sticker = stickers.get(key);
        if (!sticker) return;
        stickers.delete(key);
        clearTimeout(sticker.timer);
        hub.broadcastAll({ type: 'stickerRemoved', id: sticker.id });
    };

    hub.on('stickerPlace', ({ ws, user }, data) => {
        if (!user.username || !data) return;
        const key = typeof data.ownerKey === 'string' && KEY_PATTERN.test(data.ownerKey) ? data.ownerKey : `user:${user.id}`;
        const now = Date.now();
        const wait = COOLDOWN_MS - (now - Math.max(lastPlaced.get(key) ?? 0, user.lastSticker ?? 0));
        if (wait > 0) {
            hub.send(ws, { type: 'stickerCooldown', wait });
            return;
        }
        if (!STICKER_IDS.includes(data.stickerId)) return;
        const position = [finite(data.x, WORLD_LIMIT), finite(data.y, HEIGHT_LIMIT), finite(data.z, WORLD_LIMIT)];
        const normal = unit(data.nx, data.ny, data.nz);
        const up = unit(data.ux, data.uy, data.uz);
        if (position.includes(null) || !normal || !up) return;
        lastPlaced.set(key, now);
        user.lastSticker = now;

        remove(key);
        if (stickers.size >= MAX_STICKERS) remove(stickers.keys().next().value);
        const sticker = { id: nextId++, stickerId: data.stickerId, position, normal, up };
        sticker.timer = setTimeout(() => {
            if (stickers.get(key) === sticker) remove(key);
            lastPlaced.delete(key);
        }, LIFETIME_MS);
        stickers.set(key, sticker);
        hub.broadcastAll({ type: 'stickerPlaced', ...publicSticker(sticker) });
    });

    hub.onJoin(({ ws }) => {
        hub.send(ws, { type: 'stickerStates', stickers: [...stickers.values()].map(publicSticker) });
    });
}

module.exports = { registerStickers };
