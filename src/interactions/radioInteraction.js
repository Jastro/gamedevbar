// Room radios: click or F to open the station picker (the station is shared by the room).
export function createRadioInteraction(game) {
    return {
        type: 'radio',
        range: 2.5, // it sits on the bar counter
        hint() {
            return 'Cambiar emisora';
        },
        use(object) {
            const room = game.world.getRoomForObject(object);
            if (room) game.ui.radio.open(room.id);
        }
    };
}
