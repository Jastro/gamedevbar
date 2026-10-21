const { LIMITS } = require('./config');

const MODEL_ID_PATTERN = /^[a-z0-9_-]{1,32}$/i;

function cleanString(value, maxLength) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().slice(0, maxLength);
    return trimmed.length > 0 ? trimmed : null;
}

function cleanUsername(value) {
    return cleanString(value, LIMITS.usernameLength) || 'Anónimo';
}

// The model id ends up in a client asset path (/assets/models/<id>.glb).
function cleanModelId(value) {
    return typeof value === 'string' && MODEL_ID_PATTERN.test(value) ? value : 'pj';
}

// Accessories, tint, size, name color. The catalog lives on the client
// (src/appearance/catalog.js), which drops unknown ids, so the server only
// checks the shape: short ids, #rrggbb colors, a clamped scale.
const ITEM_ID_PATTERN = /^[a-z0-9-]{1,24}$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const APPEARANCE_SLOTS = ['head', 'face', 'hand'];

function cleanAppearance(value) {
    const result = { head: null, face: null, hand: null, tint: null, scale: 1, nameColor: null };
    if (!value || typeof value !== 'object') return result;
    APPEARANCE_SLOTS.forEach(slot => {
        if (typeof value[slot] === 'string' && ITEM_ID_PATTERN.test(value[slot])) result[slot] = value[slot];
    });
    ['tint', 'nameColor'].forEach(key => {
        if (typeof value[key] === 'string' && COLOR_PATTERN.test(value[key])) result[key] = value[key].toLowerCase();
    });
    const scale = Number(value.scale);
    if (Number.isFinite(scale)) result.scale = Math.min(1.15, Math.max(0.85, scale));
    return result;
}

module.exports = { cleanString, cleanUsername, cleanModelId, cleanAppearance };
