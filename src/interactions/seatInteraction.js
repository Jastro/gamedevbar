// Chairs, stools and the toilet: click to sit; WASD stands up (LocalPlayer).
export function createSeatInteraction(game) {
    return {
        type: 'seat',
        use(object) {
            const player = game.players.localPlayer;
            if (player && !player.isSitting) player.sitDown(object);
        }
    };
}
