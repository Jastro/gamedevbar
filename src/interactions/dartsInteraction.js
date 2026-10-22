// The dartboard and its yellow throw line: click or F to step up and throw
// (DartsSync).
const OCHE_REACH = 3;

export function createDartsInteraction(game) {
    return {
        type: 'dartboard',
        range: 2.2,
        use(object) {
            const { dartboard } = object.userData;
            const player = game.players.localPlayer;
            if (!player || player.isSitting || game.playMode) return;
            const inside = game.world.getRoomAt(player.position) === dartboard.room;
            if (!inside || dartboard.distanceToOche(player.position) > OCHE_REACH) {
                game.ui.chat?.addMessage({ type: 'system', message: '🎯 Ponte en la línea amarilla para tirar.' });
                return;
            }
            game.dartsSync.request(dartboard);
        },
        hint(object) {
            const thrower = game.dartsSync.states.get(object.userData.dartboard.id)?.thrower;
            return thrower ? `Está tirando ${thrower.name}` : 'Jugar a los dardos';
        }
    };
}
