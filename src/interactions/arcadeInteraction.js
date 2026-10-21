import { ArcadePong } from '../world/ArcadePong';

// Arcade cabinets: click or F when close to start (Pong: second click by
// another player joins as player 2).
export function createArcadeInteraction(game) {
    return {
        type: 'arcade',
        range: 3, // same as ArcadePong/ArcadeSnake.checkPlayerProximity
        hint(object) {
            return object.userData.arcade instanceof ArcadePong ? 'Jugar al Pong' : 'Jugar al Snake';
        },
        use(object) {
            const arcade = object.userData.arcade;
            const player = game.players.localPlayer;
            if (!arcade || !player) return;

            if (!arcade.checkPlayerProximity(player.position)) {
                game.ui.chat?.addMessage({ type: 'system', message: '¡Acércate más al arcade para jugar!' });
                return;
            }

            if (arcade instanceof ArcadePong) {
                if (arcade.gameState === 'title') {
                    arcade.startOnePlayerGame(player);
                    game.network.send('arcadeState', { type: 'startGame', playerId: player.id });
                } else if (arcade.gameState === 'onePlayer' && arcade.currentPlayer.id !== player.id) {
                    arcade.startTwoPlayerGame(player);
                    game.network.send('arcadeState', { type: 'playerJoined', playerId: player.id });
                }
            } else if (arcade.gameState === 'title') {
                // Snake solo necesita startGame
                arcade.startGame();
            }
        }
    };
}

// Server → arcade updates: shared Snake high scores, and Pong state for the
// Gamedev room's machine.
export function bindArcadeNetwork(game) {
    game.network.on('snakeHighScores', (data) => game.environment.updateSnakeHighScores(data.scores));

    // Never fires today (Docs/Systems.md known issues: Pong sync); kept for the fix.
    game.network.on('arcadeUpdate', (data) => {
        const arcade = game.environment.arcadePong;
        const players = game.players.players;
        if (!arcade) return;

        switch (data.action) {
            case 'startGame':
                arcade.startOnePlayerGame(players.get(data.playerId));
                break;
            case 'playerJoined': {
                const joiningPlayer = players.get(data.playerId);
                game.ui.chat.addMessage({
                    type: 'system',
                    message: `${joiningPlayer?.username} se ha unido al juego. La partida comenzará en 3 segundos...`
                });
                break;
            }
            case 'startTwoPlayer':
                arcade.startTwoPlayerGame(players.get(data.player1Id), players.get(data.player2Id));
                break;
            case 'updateState':
                arcade.updateGameState(data.state);
                break;
        }
    });
}
