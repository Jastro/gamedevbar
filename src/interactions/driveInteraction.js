// The drivable cars: click or F next to one to drive it (DrivingSync).
const REACH = 3.5;

export function createDriveInteraction(game) {
    return {
        type: 'drivableCar',
        range: 3,
        use(object) {
            const { car } = object.userData;
            const player = game.players.localPlayer;
            if (!player || player.isSitting || game.playMode) return;
            const near = Math.hypot(car.position.x - player.position.x, car.position.z - player.position.z) <= REACH;
            if (!near) {
                game.ui.chat?.addMessage({ type: 'system', message: '🚗 Acércate al coche.' });
                return;
            }
            game.drivingSync.request(car);
        },
        hint(object) {
            const entry = game.drivingSync.cars.get(object.userData.car.id);
            return entry?.driver ? `Lo conduce ${entry.name ?? 'alguien'}` : 'Conducir';
        }
    };
}
