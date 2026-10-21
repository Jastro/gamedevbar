// The identity this browser remembers: nick, character and whether the
// "personalize?" popup was already answered. Kept in one place because inside
// a forum iframe localStorage is partitioned (and the nick will come from the
// forum), so this is what moves when that happens. Every access tolerates
// storage being unavailable (private mode, blocked site data).

export const MODEL_IDS = ['pj', 'pj2', 'pj3', 'pj4', 'pj5', 'pj6'];

const NAME_KEY = 'playerName';
const MODEL_KEY = 'selectedModel';
const PROMPT_KEY = 'customizePromptSeen';

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

export function hasSeenCustomizePrompt() {
    return read(PROMPT_KEY) === '1';
}

export function markCustomizePromptSeen() {
    write(PROMPT_KEY, '1');
}
