// Projector screens: click or F to open the video controls for that room.
export function createProjectorInteraction(game) {
    return {
        type: 'projector',
        range: 4, // a big screen on the wall
        hint() {
            return 'Proyector (vídeos)';
        },
        use(object) {
            const room = game.world.getRoomForObject(object);
            if (room) game.ui.projector.open(room.id);
        }
    };
}
