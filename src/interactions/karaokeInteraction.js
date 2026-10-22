// The karaoke mic stand: click or F to step up to the mic (you can also
// jump onto the stage). Lyrics: a karaoke video on the projector.
const MIC_REACH = 3;

export function createKaraokeInteraction(game) {
    return {
        type: 'karaokeMic',
        range: 2.5,
        // Already on the stage: nothing to offer (F stays free).
        canReach: (object, position) => !object.userData.stage.contains(position),
        use(object) {
            const { stage } = object.userData;
            const player = game.players.localPlayer;
            if (!player || player.isSitting || game.playMode) return;
            const inside = game.world.getRoomAt(player.position) === stage.room;
            const mic = object.getWorldPosition(object.position.clone());
            if (!inside || Math.hypot(mic.x - player.position.x, mic.z - player.position.z) > MIC_REACH) {
                game.ui.chat?.addMessage({ type: 'system', message: '🎤 Acércate al escenario.' });
                return;
            }
            const spot = stage.getMicSpot();
            player.position.copy(spot.position);
            player.rotation = spot.rotation;
            player.stopMoving?.();
            game.ui.chat?.addMessage({ type: 'system', message: '🎤 ¡Al escenario! Tu voz llega a todo el bar (V para hablar). Pon la letra en el proyector.' });
        },
        hint() {
            return 'Subir al escenario';
        }
    };
}
