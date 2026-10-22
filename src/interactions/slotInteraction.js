import { BET } from '../world/SlotMachine';

// The tragaperras: click or F pulls the lever (SlotSync).
const REACH = 2.5;

export function createSlotInteraction(game) {
    return {
        type: 'slotMachine',
        range: 2.2,
        use(object) {
            const { machine } = object.userData;
            const player = game.players.localPlayer;
            if (!player || player.isSitting) return;
            const inside = game.world.getRoomAt(player.position) === machine.room;
            if (!inside || machine.distanceTo(player.position) > REACH) {
                game.ui.chat?.addMessage({ type: 'system', message: '🎰 Acércate a la máquina.' });
                return;
            }
            game.slotSync.pull(machine);
        },
        hint(object) {
            if (object.userData.machine.isSpinning()) return 'Girando…';
            return `Tragaperras · ${BET} 🪙 (tienes ${game.slotSync.coins})`;
        }
    };
}
