import { ArcadePong } from '../world/ArcadePong';

// Arcade cabinets: click or F when close. Snake is local; Pong asks the
// server for a place (first player against the CPU, a second one joins and
// the match restarts 1 vs 1, see server/features/pong.js).
export function createArcadeInteraction(game) {
    return {
        type: 'arcade',
        range: 3, // same as ArcadePong/ArcadeSnake.checkPlayerProximity
        hint(object) {
            const arcade = object.userData.arcade;
            if (!(arcade instanceof ArcadePong)) return 'Jugar al Snake';
            const { mode, player1 } = arcade.machine;
            if (mode === 'onePlayer' && arcade.role === 'watcher') return `Retar a ${player1?.name ?? 'quien juega'} al Pong`;
            if (mode === 'twoPlayer' && arcade.role === 'watcher') return 'Pong: partida en curso';
            return 'Jugar al Pong';
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
                if (arcade.role !== 'watcher') return;
                if (arcade.machine.mode === 'twoPlayer') {
                    game.ui.chat?.addMessage({ type: 'system', message: '🏓 Ya hay dos jugando, espera a que acaben.' });
                    return;
                }
                if (player.isSitting) player.standUp();
                arcade.join();
            } else if (arcade.gameState === 'title') {
                arcade.startGame();
            }
        }
    };
}

// Server → arcades: shared Snake high scores, and each room's Pong machine.
export function bindArcadeNetwork(game) {
    const pong = (machineId) => game.environment.rooms.get(machineId)?.arcadePong ?? null;
    game.network.on('snakeHighScores', (data) => game.environment.updateSnakeHighScores(data.scores));
    game.network.on('pongMachines', (data) => {
        Object.entries(data.machines || {}).forEach(([machineId, state]) => pong(machineId)?.applyMachine(state));
    });
    game.network.on('pongMachine', (data) => {
        const arcade = pong(data.machineId);
        if (!arcade) return;
        const before = arcade.machine;
        arcade.applyMachine(data.state);
        const { player2, mode } = arcade.machine;
        if (mode === 'twoPlayer' && before.mode === 'onePlayer' && player2) {
            game.ui.chat?.addMessage({ type: 'system', message: `🏓 ${player2.name} se une al Pong. ¡Nueva partida!` });
        }
    });
    game.network.on('pongState', (data) => pong(data.machineId)?.applySnapshot(data));
    game.network.on('pongPaddle', (data) => {
        if (typeof data.y === 'number') pong(data.machineId)?.applyPaddle(data.y);
    });
    game.network.on('pongBusy', () => {
        game.ui.chat?.addMessage({ type: 'system', message: '🏓 Ya hay dos jugando, espera a que acaben.' });
    });
}
