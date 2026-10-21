import { VIRCON_INTERACT_DISTANCE } from '../world/VirconCabinet';

// Vircon32 cabinets: click (or F) when close to open the game picker.
export function createVirconInteraction(game) {
    const nearestCabinet = (position) => {
        let nearest = null;
        game.environment.rooms.forEach(({ vircon }) => {
            if (vircon && vircon.distanceTo(position) <= VIRCON_INTERACT_DISTANCE) nearest = vircon;
        });
        return nearest;
    };

    return {
        type: 'vircon',
        use(object) {
            const cabinet = object.userData.cabinet;
            const player = game.players.localPlayer;
            if (!cabinet || !player || game.playMode) return;
            if (cabinet.distanceTo(player.position) > VIRCON_INTERACT_DISTANCE) {
                game.ui.chat?.addMessage({ type: 'system', message: '¡Acércate más a la Vircon32 para jugar!' });
                return;
            }
            game.ui.vircon.open(cabinet.room.id);
        },
        findNearby(position) {
            return nearestCabinet(position)?.group ?? null;
        },
        hint() {
            return 'Jugar a la Vircon32';
        }
    };
}
