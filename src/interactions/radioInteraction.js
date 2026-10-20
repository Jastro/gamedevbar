// Room radios: click to open the station picker (the station is shared by the room).
export function createRadioInteraction(game) {
    return {
        type: 'radio',
        use(object) {
            const room = game.world.getRoomForObject(object);
            if (room) game.ui.radio.open(room.id);
        }
    };
}
