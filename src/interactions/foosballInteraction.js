import { TEAM_NAMES } from '../world/Foosball';

// The futbolín: click or F on one long side to play for that side's team
// (FoosballSync).
const REACH = 1.6; // from the table's edge

export function createFoosballInteraction(game) {
    return {
        type: 'foosball',
        range: 2.6,
        use(object) {
            const { table } = object.userData;
            const player = game.players.localPlayer;
            if (!player || player.isSitting || game.playMode) return;
            const inside = game.world.getRoomAt(player.position) === table.room;
            if (!inside || table.distanceTo(player.position) > REACH) {
                game.ui.chat?.addMessage({ type: 'system', message: '⚽ Acércate a un lado del futbolín.' });
                return;
            }
            game.foosballSync.join(table);
        },
        hint(object) {
            const player = game.players.localPlayer;
            const team = player ? object.userData.table.sideOf(player.position) : 0;
            return `Jugar al futbolín (${TEAM_NAMES[team]})`;
        }
    };
}
