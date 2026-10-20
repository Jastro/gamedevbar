import { DOOR_INTERACT_DISTANCE } from './Door';

// Server-authoritative door state: toggles go to the server, which broadcasts
// `doorState` to everyone (snapshot `doorStates` on join). Offline we toggle locally.
export class DoorSync {
    constructor(game) {
        this.game = game;
    }

    bind() {
        const { network, environment } = this.game;
        network.on('doorState', (data) => environment.setDoorState(data.doorId, data.isOpen));
        // Snapshot sent on join: apply without animating.
        network.on('doorStates', (data) => {
            Object.entries(data.doors || {}).forEach(([doorId, isOpen]) => {
                environment.setDoorState(doorId, isOpen, true);
            });
        });
    }

    toggle(door) {
        if (this.game.network.isConnected) {
            this.game.network.send('doorToggle', { doorId: door.id });
        } else {
            door.setOpen(!door.isOpen);
        }
    }

    // Player-initiated toggle: only within reach.
    tryToggle(door) {
        const player = this.game.players.localPlayer;
        if (!player || player.isSitting) return;
        if (door.distanceTo(player.position) <= DOOR_INTERACT_DISTANCE) {
            this.toggle(door);
        } else {
            this.game.ui.chat?.addMessage({ type: 'system', message: '¡Acércate más a la puerta!' });
        }
    }
}
