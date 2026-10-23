// Profiles (src/ui/ProfileUI.js): clicking an avatar asks for that player's
// week (leaderboards) and their tragaperras coins; the rest (name,
// character, accessories, where they are) the client already knows.
const START_COINS = 100; // as in slots.js until they've played
const MIN_INTERVAL_MS = 300;

function registerProfiles(hub) {
    hub.on('profileRequest', ({ ws, user }, { userId }) => {
        if (!user.username || typeof userId !== 'string') return;
        const now = Date.now();
        if (now - (user.lastProfileRequest ?? 0) < MIN_INTERVAL_MS) return;
        user.lastProfileRequest = now;
        const target = hub.findUser(userId);
        if (!target?.user.username) return;
        hub.send(ws, {
            type: 'profile',
            userId,
            name: target.user.username,
            stats: hub.leaderboards?.stats(target.user.username) ?? {},
            coins: target.user.slotCoins ?? START_COINS
        });
    });
}

module.exports = { registerProfiles };
