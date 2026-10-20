const { LIMITS } = require('../config');
const { cleanUsername } = require('../validation');

// Snake high scores and Pong state relay.
function registerArcade(hub) {
    const snakeHighScores = [];

    hub.on('snakeHighScore', (ctx, data) => {
        if (typeof data.score !== 'number' || !Number.isFinite(data.score)) return;
        snakeHighScores.push({ name: cleanUsername(data.username), score: data.score });
        snakeHighScores.sort((a, b) => b.score - a.score);
        if (snakeHighScores.length > LIMITS.snakeHighScores) snakeHighScores.length = LIMITS.snakeHighScores;
        hub.broadcastAll({ type: 'snakeHighScores', scores: snakeHighScores });
    });

    // Known issue: the client's `type` field overrides 'arcadeState'
    // (WebSocketManager.send), so the inner switch never matches and Pong is
    // effectively local-only. Kept as-is until Pong sync is redone.
    hub.on('arcadeState', (ctx, data) => {
        hub.broadcastAll({ type: 'arcadeState', gameState: data.gameState, data: data.data });
        switch (data.type) {
            case 'startGame':
                hub.broadcastAll({ type: 'arcadeUpdate', action: 'startGame', playerId: data.playerId });
                break;
            case 'playerJoined':
                hub.broadcastAll({ type: 'arcadeUpdate', action: 'playerJoined', playerId: data.playerId });
                // Esperar 3 segundos y reiniciar el juego
                setTimeout(() => {
                    hub.broadcastAll({
                        type: 'arcadeUpdate',
                        action: 'startTwoPlayer',
                        player1Id: data.currentPlayerId,
                        player2Id: data.playerId
                    });
                }, 3000);
                break;
            case 'gameState':
                hub.broadcastAll({ type: 'arcadeUpdate', action: 'updateState', state: data.state });
                break;
        }
    });
}

module.exports = { registerArcade };
