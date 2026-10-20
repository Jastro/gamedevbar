// Room radios: click to pause/resume the music (local to this player).
export function createRadioInteraction() {
    return {
        type: 'radio',
        use(object) {
            object.userData.radio?.toggleSound();
        }
    };
}
