// The tragaperras (a video-game meme slot machine), one per room. The server
// rolls the reels and keeps each player's coins (per connection, nothing is
// saved); everyone gets the result and watches the same spin
// (src/world/SlotMachine.js draws it).
const { isRoomId } = require('../config');

const BET = 10;
const START_COINS = 100;
const BAILOUT = 50;            // the owner lends you this when you're broke...
const BAILOUT_MS = 60 * 1000;  // ...once a minute
const SPIN_MS = 2600;          // the machine is busy while the reels turn
const PAIR = 18;               // any pair: the bet back and a bit

// Rarer symbols pay more; with PAIR the machine returns ~88% of what's bet.
// Keep ids in sync with SYMBOLS in SlotMachine.js.
const SYMBOLS = [
    { id: 'leeroy', weight: 22, triple: 60 },       // LEEROY JENKINS (at least I have chicken)
    { id: 'barrelroll', weight: 20, triple: 80 },   // Do a barrel roll!
    { id: 'youdied', weight: 14, triple: -20 },     // YOU DIED: three take 20 more
    { id: 'takethis', weight: 14, triple: 120 },    // It's dangerous to go alone!
    { id: 'oneup', weight: 12, triple: 160 },       // 1UP
    { id: 'cake', weight: 8, triple: 0 },           // the cake is a lie
    { id: 'pressf', weight: 6, triple: 200 },       // Press F to pay respects
    { id: 'ggez', weight: 4, triple: 1000 }         // GG EZ: jackpot
];
const TOTAL_WEIGHT = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);

function roll() {
    let pick = Math.random() * TOTAL_WEIGHT;
    for (const symbol of SYMBOLS) {
        pick -= symbol.weight;
        if (pick < 0) return symbol.id;
    }
    return SYMBOLS[0].id;
}

// What a spin pays (the bet is already gone): three of a kind by symbol,
// any pair pays PAIR.
function payout(reels) {
    const [a, b, c] = reels;
    if (a === b && b === c) return SYMBOLS.find(symbol => symbol.id === a).triple;
    if (a === b || b === c || a === c) return PAIR;
    return 0;
}

function registerSlots(hub) {
    const busyUntil = new Map(); // roomId -> ms

    hub.on('slotSpin', ({ ws, user }, { roomId }) => {
        if (!user.username || !isRoomId(roomId)) return;
        const now = Date.now();
        if (now < (busyUntil.get(roomId) ?? 0)) {
            hub.send(ws, { type: 'slotBusy', roomId });
            return;
        }
        let coins = user.slotCoins ?? START_COINS;
        let bailout = false;
        if (coins < BET) {
            const wait = (user.lastBailout ?? 0) + BAILOUT_MS - now;
            if (wait > 0) {
                hub.send(ws, { type: 'slotBroke', roomId, retryIn: Math.ceil(wait / 1000) });
                return;
            }
            user.lastBailout = now;
            coins += BAILOUT;
            bailout = true;
        }
        const reels = [roll(), roll(), roll()];
        const win = payout(reels);
        coins = Math.max(0, coins - BET + win);
        user.slotCoins = coins;
        busyUntil.set(roomId, now + SPIN_MS);
        hub.broadcastAll({ type: 'slotResult', roomId, userId: user.id, name: user.username, reels, win, coins, bailout });
    });
}

module.exports = { registerSlots, payout, SYMBOLS, BET };
