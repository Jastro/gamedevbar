// The street car: click it or press F next to it to take a free seat
// (CarSync). WASD gets you out.
const CAR_REACH = 3.5;

export function createCarInteraction(game) {
    return {
        type: 'car',
        use() {
            const player = game.players.localPlayer;
            const car = game.environment.car;
            if (!player || !car) return;
            if (car.distanceTo(player.position) > CAR_REACH) {
                game.ui.chat?.addMessage({ type: 'system', message: '¡Acércate más al coche!' });
                return;
            }
            game.carSync.enter();
        },
        findNearby(position) {
            const car = game.environment.car;
            return car && car.distanceTo(position) <= CAR_REACH ? car.group : null;
        },
        hint() {
            const sync = game.carSync;
            if (sync.riding) return 'El coche está de viaje…';
            const free = sync.freeSlots;
            return free > 0 ? `Subir al coche (${free} de 5 libres)` : 'El coche está lleno';
        }
    };
}
