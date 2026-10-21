import { VIRCON_INTERACT_DISTANCE } from '../world/VirconCabinet';

// Web-game cabinets (Pokebonk): click or F when close to play it on the
// cabinet screen (one player at a time, like the Vircon32).
export function createWebGameInteraction(game) {
    return {
        type: 'webgame',
        range: VIRCON_INTERACT_DISTANCE,
        use(object) {
            const cabinet = object.userData.cabinet;
            const player = game.players.localPlayer;
            if (!cabinet || !player || game.playMode) return;
            if (cabinet.distanceTo(player.position) > VIRCON_INTERACT_DISTANCE) {
                game.ui.chat?.addMessage({ type: 'system', message: `¡Acércate más a la máquina de ${cabinet.config.title}!` });
                return;
            }
            game.ui.vircon.playWebGame(cabinet);
        },
        hint(object) {
            return `Jugar a ${object.userData.cabinet.config.title}`;
        }
    };
}
