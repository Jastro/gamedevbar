// The identity this browser remembers: nick, character and whether the
// "personalize?" popup was already answered. Kept in one place because inside
// a forum iframe localStorage is partitioned (and the nick will come from the
// forum), so this is what moves when that happens. Every access tolerates
// storage being unavailable (private mode, blocked site data).

export const MODEL_IDS = ['pj', 'pj2', 'pj3', 'pj4', 'pj5', 'pj6'];

const NAME_KEY = 'playerName';
const MODEL_KEY = 'selectedModel';
const PROMPT_KEY = 'customizePromptSeen';
const APPEARANCE_KEY = 'playerAppearance';
const STICKER_KEY = 'sticker';
const STICKER_OWNER_KEY = 'stickerOwnerKey';
const MOUSE_CAPTURE_KEY = 'captureMouse';

function read(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function write(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Not critical: it just won't be remembered.
    }
}

export function loadProfile() {
    const name = read(NAME_KEY)?.trim() || null;
    const model = read(MODEL_KEY);
    return { name, model: MODEL_IDS.includes(model) ? model : null };
}

export function saveName(name) {
    write(NAME_KEY, name);
}

export function saveModel(modelId) {
    if (MODEL_IDS.includes(modelId)) write(MODEL_KEY, modelId);
}

export function randomModel() {
    return MODEL_IDS[Math.floor(Math.random() * MODEL_IDS.length)];
}

export function placeholderName() {
    return `Parroquiano ${1000 + Math.floor(Math.random() * 9000)}`;
}

// Raw saved appearance (normalized by the caller, see appearance/catalog.js).
export function loadAppearance() {
    try {
        return JSON.parse(read(APPEARANCE_KEY) || 'null');
    } catch {
        return null;
    }
}

export function saveAppearance(appearance) {
    write(APPEARANCE_KEY, JSON.stringify(appearance));
}

// The sticker picked in the 👤 menu (validated by the caller).
export function loadSticker() {
    return read(STICKER_KEY);
}

export function saveSticker(stickerId) {
    write(STICKER_KEY, stickerId);
}

// A random key that marks this browser's sticker on the server (so a new
// one replaces it, even after a reconnect). Never shown to anyone else.
export function stickerOwnerKey() {
    let key = read(STICKER_OWNER_KEY);
    if (!key || !/^[A-Za-z0-9_-]{8,40}$/.test(key)) {
        key = Array.from({ length: 24 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
        write(STICKER_OWNER_KEY, key);
    }
    return key;
}

// ⚙️ → Ratón: lock the pointer while dragging the camera (Camera.js).
export function loadMouseCapture() {
    return read(MOUSE_CAPTURE_KEY) === '1';
}

export function saveMouseCapture(enabled) {
    write(MOUSE_CAPTURE_KEY, enabled ? '1' : '0');
}

export function hasSeenCustomizePrompt() {
    return read(PROMPT_KEY) === '1';
}

export function markCustomizePromptSeen() {
    write(PROMPT_KEY, '1');
}
