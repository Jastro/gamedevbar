// Chairs, stools and the toilet: click or F to sit; WASD stands up (LocalPlayer).
export function createSeatInteraction(game) {
    return {
        type: 'seat',
        range: 1.3,
        hint(object) {
            return object.userData.isBathroom ? 'Usar el baño' : 'Sentarse';
        },
        use(object) {
            const player = game.players.localPlayer;
            if (player && !player.isSitting) player.sitDown(object);
        }
    };
}
