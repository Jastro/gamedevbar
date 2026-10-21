import { LIGHT_NAMES } from '../world/LightSwitches';

// Light switches by each bar's door: click or F to flip one (shared by the
// room, see LightsSync).
const SWITCH_REACH = 2.5;

export function createLightSwitchInteraction(game) {
    return {
        type: 'lightSwitch',
        range: 1.8,
        use(object) {
            const { switches, light } = object.userData;
            const player = game.players.localPlayer;
            if (!player || player.isSitting) return;
            if (switches.distanceTo(player.position, light) > SWITCH_REACH) {
                game.ui.chat?.addMessage({ type: 'system', message: '¡Acércate más al interruptor!' });
                return;
            }
            game.lightsSync.toggle(switches.room.id, light);
        },
        hint(object) {
            const { switches, light } = object.userData;
            return `${switches.state[light] ? 'Apagar' : 'Encender'} ${LIGHT_NAMES[light]}`;
        }
    };
}
