const { LIMITS } = require('../config');
const { cleanUsername } = require('../validation');

// Snake high scores (Pong: features/pong.js).
function registerArcade(hub) {
    const snakeHighScores = [];

    hub.on('snakeHighScore', (ctx, data) => {
        if (typeof data.score !== 'number' || !Number.isFinite(data.score)) return;
        snakeHighScores.push({ name: cleanUsername(data.username), score: data.score });
        snakeHighScores.sort((a, b) => b.score - a.score);
        if (snakeHighScores.length > LIMITS.snakeHighScores) snakeHighScores.length = LIMITS.snakeHighScores;
        hub.broadcastAll({ type: 'snakeHighScores', scores: snakeHighScores });
    });
}

module.exports = { registerArcade };
