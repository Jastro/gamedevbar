// Doors: click or press F nearby to open/close (state lives on the server, see DoorSync).
export function createDoorInteraction(game) {
    return {
        type: 'door',
        use(object) {
            game.doorSync.tryToggle(object.userData.door);
        },
        findNearby(position) {
            return game.environment.getNearestDoor(position)?.group ?? null;
        },
        hint(object) {
            return `${object.userData.door.isOpen ? 'Cerrar' : 'Abrir'} puerta`;
        }
    };
}
