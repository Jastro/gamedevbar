// Right-click gestures (src/entities/Gestures.js): relayed to everyone else
// so they see them; nothing is kept (late joiners don't see one in progress).
const GESTURES = ['dance', 'pushups', 'jerk', 'kiss', 'spit', 'cheer', 'toast'];
const MIN_INTERVAL_MS = 400;

function registerGestures(hub) {
    hub.on('playerGesture', ({ ws, user }, { gesture }) => {
        if (!user.username || !GESTURES.includes(gesture)) return;
        const now = Date.now();
        if (now - (user.lastGesture ?? 0) < MIN_INTERVAL_MS) return;
        user.lastGesture = now;
        hub.broadcast({ type: 'playerGesture', userId: user.id, gesture }, ws);
    });

    hub.on('playerGestureStop', ({ ws, user }) => {
        if (!user.username) return;
        hub.broadcast({ type: 'playerGestureStop', userId: user.id }, ws);
    });
}

module.exports = { registerGestures };
