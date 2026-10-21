import { DEFAULT_LIGHTS } from './LightSwitches';

// Room lights are server state, like doors: `lightsToggle` goes up, and the
// server answers `lightsState` to everyone (snapshot `lightsStates` on join).
// Offline we flip locally.
export class LightsSync {
    constructor(game) {
        this.game = game;
    }

    bind() {
        const { network, environment } = this.game;
        network.on('lightsState', (data) => environment.setLights(data.roomId, data.state));
        network.on('lightsStates', (data) => {
            // Rooms nobody touched aren't listed: back to the default.
            environment.rooms.forEach((contents, roomId) => {
                environment.setLights(roomId, data.rooms?.[roomId] ?? DEFAULT_LIGHTS);
            });
        });
    }

    toggle(roomId, light) {
        if (this.game.network.isConnected) {
            this.game.network.send('lightsToggle', { roomId, light });
            return;
        }
        const current = this.game.environment.getLights(roomId);
        this.game.environment.setLights(roomId, { ...current, [light]: !current[light] });
    }
}
