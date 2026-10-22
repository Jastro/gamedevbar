import { FloatingPanel } from '../ui/FloatingPanel';
import { Shame } from '../entities/Shame';

// Bathroom shared state (server: server/features/bathroom.js) and the
// player-facing actions: door, latch, light, toilet (pee/poo), flush, sink,
// air freshener. Also tracks who has dirty hands and shows the shame on them
// while they're outside a bathroom.
export class BathroomSync {
    constructor(game) {
        this.game = game;
        this.dirty = new Set(); // userIds with dirty hands
        this.shames = new Map(); // userId -> Shame
        this.createToiletPanel();
    }

    get bathrooms() {
        return this.game.environment.getBathrooms();
    }

    bathroom(roomId) {
        return this.game.environment.rooms.get(roomId)?.bathroom ?? null;
    }

    get localId() {
        return this.game.players.localPlayer?.id;
    }

    createToiletPanel() {
        this.panel = new FloatingPanel('toilet-panel', '🚽 ¿Qué vas a hacer?');
        const actions = document.createElement('div');
        actions.className = 'floating-panel-actions';
        [['pee', '💧 Pis'], ['poo', '💩 Caca']].forEach(([kind, label]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'floating-panel-button';
            button.textContent = label;
            button.addEventListener('click', () => {
                this.panel.close();
                if (this.panelBathroom) this.send('toiletUse', this.panelBathroom, { kind });
            });
            actions.appendChild(button);
        });
        this.panel.body.appendChild(actions);
    }

    bind() {
        const { network } = this.game;
        network.on('bathroomStates', (data) => {
            Object.entries(data.rooms || {}).forEach(([roomId, state]) => this.bathroom(roomId)?.applyState(state));
            this.dirty = new Set(Array.isArray(data.dirty) ? data.dirty : []);
        });
        network.on('bathroomState', (data) => this.bathroom(data.roomId)?.applyState(data.state));
        network.on('bathroomEvent', (data) => this.handleEvent(data));
        network.on('hygiene', (data) => {
            if (data.dirty) this.dirty.add(data.userId); else this.dirty.delete(data.userId);
            if (data.userId === this.localId && !data.dirty && this.washing) {
                this.washing = false;
                this.game.ui.chat?.addMessage({ type: 'system', message: '🧼 Manos limpias.' });
            }
        });
        network.on('bathroomRefused', (data) => {
            const message = data.reason === 'latched'
                ? '🔒 Está cerrado por dentro.'
                : '🚽 Está ocupado, espera tu turno.';
            this.game.ui.chat?.addMessage({ type: 'system', message });
        });
        // Getting up from the toilet (WASD) frees it.
        this.bathrooms.forEach(bathroom => {
            [bathroom.sitSpot, bathroom.standSpot].forEach(spot => {
                spot.userData.onStand = () => this.send('toiletLeave', bathroom);
            });
        });
    }

    send(type, bathroom, data = {}) {
        this.game.network.send(type, { roomId: bathroom.room.id, ...data });
    }

    // --- Actions (from the interactions) --------------------------------

    toggleDoor(bathroom) {
        this.send('bathroomDoor', bathroom);
    }

    toggleLatch(bathroom) {
        this.send('bathroomLatch', bathroom);
    }

    toggleLight(bathroom) {
        this.send('bathroomLight', bathroom);
    }

    useToilet(bathroom) {
        const occupant = bathroom.state.occupant;
        if (occupant && occupant !== this.localId && this.game.players.players.has(occupant)) {
            this.game.ui.chat?.addMessage({ type: 'system', message: '🚽 Está ocupado, espera tu turno.' });
            return;
        }
        this.panelBathroom = bathroom;
        this.panel.open();
    }

    flush(bathroom) {
        this.send('toiletFlush', bathroom);
    }

    washHands(bathroom) {
        this.washing = this.dirty.has(this.localId);
        this.send('washHands', bathroom);
    }

    spray(bathroom) {
        this.send('airFreshener', bathroom);
    }

    // --- Server events -----------------------------------------------------

    handleEvent({ roomId, kind, userId }) {
        const bathroom = this.bathroom(roomId);
        if (!bathroom) return;
        bathroom.playEvent(kind, this.game.environment.audioListener);
        const player = this.game.players.localPlayer;
        if (userId !== this.localId || !player) return;
        // Our own toilet visit: sit down (poo) or stand facing the bowl (pee).
        if (kind === 'pee' || kind === 'poo') {
            const spot = kind === 'poo' ? bathroom.sitSpot : bathroom.standSpot;
            if (player.isSitting) player.standUp();
            player.sitDown(spot);
        }
    }

    // --- Per frame ------------------------------------------------------------

    update(deltaTime) {
        const { players, environment, serverClock } = this.game;
        const local = players.localPlayer;
        this.bathrooms.forEach(bathroom => {
            bathroom.update(deltaTime, serverClock);
            bathroom.setMirrorVisible(Boolean(local && bathroom.containsPoint(local.position)));
        });

        // Shame: dirty hands, outside any bathroom.
        players.players.forEach((player, id) => {
            const show = this.dirty.has(id) && !environment.getBathroomAt(player.position);
            let shame = this.shames.get(id);
            if (show && !shame) {
                shame = new Shame();
                this.shames.set(id, shame);
                player.mesh.add(shame.group);
            } else if (!show && shame) {
                shame.dispose();
                this.shames.delete(id);
                shame = null;
            }
            if (shame) {
                // Player.loadModel keeps sprites only; re-attach after a model swap.
                if (shame.group.parent !== player.mesh) player.mesh.add(shame.group);
                shame.update(deltaTime, player.appearance?.scale ?? 1);
            }
        });
        this.shames.forEach((shame, id) => {
            if (!players.players.has(id)) {
                shame.dispose();
                this.shames.delete(id);
            }
        });
    }
}
