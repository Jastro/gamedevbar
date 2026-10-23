// Weekly leaderboards (src/world/LeaderboardSync.js shows them). Other
// features report results through `hub.leaderboards.record(category, name,
// value)`; a player is their name (no accounts). A week runs Monday to
// Sunday, Madrid time; the last finished week is kept for the profiles.
// Saved to DATA_DIR/leaderboards.json (default ./data), so a restart keeps
// them. A redeploy starts a new container: keeping them across deploys
// needs a volume on /app/data in the server's stack.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'leaderboards.json');
// How each category ranks: the highest value, the lowest (times), or a running total.
const CATEGORIES = {
    darts: 'max',    // best 3-dart turn
    foosball: 'sum', // matches won
    slots: 'max',    // biggest single win
    lap: 'min',      // fastest ring-road lap (ms)
    races: 'sum'     // races won
};
const TOP = 5;
const SAVE_DELAY = 2000;    // ms: batch writes
const PUBLISH_DELAY = 500;  // ms: batch broadcasts
const NAME_LIMIT = 24;

// "2026-W43", by the calendar date in Madrid.
function weekKey(now = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now).map(part => [part.type, part.value]));
    const date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day); // the week's Thursday
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function emptyScores() {
    return Object.fromEntries(Object.keys(CATEGORIES).map(category => [category, {}]));
}

function ranked(scores, category) {
    const mode = CATEGORIES[category];
    return Object.values(scores[category] ?? {})
        .sort((a, b) => (mode === 'min' ? a.value - b.value : b.value - a.value));
}

function registerLeaderboards(hub) {
    let state = { week: weekKey(), scores: emptyScores(), last: null };
    try {
        const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        if (saved?.week && saved.scores) state = { ...state, ...saved, scores: { ...emptyScores(), ...saved.scores } };
    } catch {
        // No file yet (or unreadable): start empty.
    }

    let saveTimer = null;
    let publishTimer = null;
    const save = () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            fs.promises.mkdir(DATA_DIR, { recursive: true })
                .then(() => fs.promises.writeFile(FILE, JSON.stringify(state)))
                .catch(error => console.error('Leaderboards not saved:', error.message));
        }, SAVE_DELAY);
    };

    const publicState = () => ({
        week: state.week,
        boards: Object.fromEntries(Object.keys(CATEGORIES).map(category => [category, ranked(state.scores, category).slice(0, TOP)]))
    });
    const publish = () => {
        clearTimeout(publishTimer);
        publishTimer = setTimeout(() => hub.broadcastAll({ type: 'leaderboardState', ...publicState() }), PUBLISH_DELAY);
    };

    // A new week: this one becomes "last week".
    const roll = () => {
        const week = weekKey();
        if (week === state.week) return;
        state = { week, scores: emptyScores(), last: { week: state.week, scores: state.scores } };
        save();
        publish();
    };

    hub.leaderboards = {
        // value: a turn's points, 1 (a win), a payout, a lap in ms.
        record(category, name, value) {
            const mode = CATEGORIES[category];
            if (!mode || typeof name !== 'string' || !name.trim() || !Number.isFinite(value)) return;
            roll();
            const display = name.trim().slice(0, NAME_LIMIT);
            const key = display.toLowerCase();
            const board = state.scores[category];
            const entry = board[key];
            if (mode === 'sum') {
                board[key] = { name: display, value: (entry?.value ?? 0) + value };
            } else if (!entry || (mode === 'max' ? value > entry.value : value < entry.value)) {
                board[key] = { name: display, value };
            } else {
                return;
            }
            save();
            publish();
            return board[key];
        },

        // A player's week: { category: { value, rank } } (missing if none).
        stats(name) {
            roll();
            const key = String(name ?? '').trim().toLowerCase();
            const result = {};
            Object.keys(CATEGORIES).forEach(category => {
                const list = ranked(state.scores, category);
                const rank = list.findIndex(entry => entry.name.toLowerCase() === key);
                if (rank !== -1) result[category] = { value: list[rank].value, rank: rank + 1 };
            });
            return result;
        },

        // The week's best in a category (for "new record" announcements).
        best(category) {
            roll();
            return ranked(state.scores, category)[0] ?? null;
        }
    };

    hub.onJoin(({ ws }) => {
        roll();
        hub.send(ws, { type: 'leaderboardState', ...publicState() });
    });
}

module.exports = { registerLeaderboards, weekKey, CATEGORIES };
