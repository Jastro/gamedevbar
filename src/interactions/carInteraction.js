// The Uber Suicida: click it or press F next to it to take a free seat
// (CarSync); the first is the driver's (DrivingSync). WASD gets you out
// (F or Esc at the wheel).
const CAR_REACH = 3.5;

export function createCarInteraction(game) {
    return {
        type: 'car',
        use() {
            const player = game.players.localPlayer;
            const car = game.environment.car;
            if (!player || !car) return;
            if (car.distanceTo(player.position) > CAR_REACH) {
                game.ui.chat?.addMessage({ type: 'system', message: '¡Acércate más al Uber Suicida!' });
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
            if (sync.riding) return 'El Uber Suicida está de viaje…';
            const free = sync.freeSlots;
            if (!sync.slots[0]) return 'Conducir el Uber Suicida';
            return free > 0 ? `Subir al Uber Suicida (${free} de 5 libres)` : 'El Uber Suicida está lleno';
        }
    };
}
