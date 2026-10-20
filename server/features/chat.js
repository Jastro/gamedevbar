const { LIMITS } = require('../config');
const { cleanString } = require('../validation');

// Global chat with a short history, join/leave announcements and /commands.
function registerChat(hub) {
    const history = [];

    // Every push goes through here so join/leave spam can't grow the history without bound.
    const addToHistory = (entry) => {
        history.push(entry);
        while (history.length > LIMITS.chatHistory) history.shift();
    };

    // Bar announcements ("Taberna" tag in the client). Exposed for other features.
    hub.announce = (message) => {
        const entry = { type: 'userChat', userId: 'taberna', message, isTaberna: true, timestamp: Date.now() };
        addToHistory(entry);
        hub.broadcastAll(entry);
    };

    hub.on('userChat', (ctx, data) => {
        const text = cleanString(data.message, LIMITS.chatLength);
        if (!text) return;
        if (text.startsWith('/') && hub.runCommand(ctx, text)) return;

        const entry = {
            type: 'userChat',
            userId: ctx.user.id,
            username: ctx.user.username,
            message: text,
            isEmote: data.isEmote === true,
            emoji: cleanString(data.emoji, LIMITS.emojiLength),
            timestamp: Date.now()
        };
        addToHistory(entry);
        hub.broadcastAll(entry);
    });

    hub.onJoin(({ ws, user }) => {
        history.forEach(entry => hub.send(ws, entry));
        hub.announce(`🍺 ¡El borracho de ${user.username} ha entrado!`);
    });

    hub.onLeave(({ user }) => {
        if (user.username) hub.announce(`🚶 ${user.username} ha salido de la taberna...`);
    });
}

module.exports = { registerChat };
