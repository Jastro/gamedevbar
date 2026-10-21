// Projector screens: click to open the video controls for that room.
export function createProjectorInteraction(game) {
    return {
        type: 'projector',
        use(object) {
            const room = game.world.getRoomForObject(object);
            if (room) game.ui.projector.open(room.id);
        }
    };
}
