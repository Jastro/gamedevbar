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
        this.panel = new FloatingPanel('toilet-panel', '🚽 ¿Qué vas a hacer, guarro?');
        const actions = document.createElement('div');
        actions.className = 'floating-panel-actions';
        [['pee', '💧 Mear'], ['poo', '💩 Cagar']].forEach(([kind, label]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'floating-panel-button';
            button.textContent = label;
            button.addEventListener('click', () => {
                this.panel.close();
                const bathroom = this.panelBathroom;
                const player = this.game.players.localPlayer;
                // Still inside and standing (the panel may have been left open).
                if (!bathroom || !player || player.isSitting || !bathroom.containsPoint(player.position)) return;
                this.send('toiletUse', bathroom, { kind });
            });
            actions.appendChild(button);
        });
        this.panel.body.appendChild(actions);
    }

    bind() {
        const { network } = this.game;
        network.on('bathroomStates', (data) => {
            Object.entries(data.rooms || {}).forEach(([roomId, state]) => this.bathroom(roomId)?.applyState(state, true));
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
                : data.reason === 'empty'
                    ? '👃 No queda nada. Vuelve en un rato.'
                    : '🚽 Está ocupado, espera tu turno.';
            this.game.ui.chat?.addMessage({ type: 'system', message });
        });
        // Getting up from the toilet (WASD) frees it.
        this.bathrooms.forEach(bathroom => {
            [bathroom.sitSpot, bathroom.standSpot].forEach(spot => {
                spot.userData.onStand = () => {
                    if (!this.reseating) this.send('toiletLeave', bathroom);
                };
            });
        });
    }

    send(type, bathroom, data = {}) {
        this.game.network.send(type, { roomId: bathroom.room.id, ...data });
    }

    // --- Actions (from the interactions) --------------------------------

    isInside(bathroom) {
        const player = this.game.players.localPlayer;
        return Boolean(player && bathroom.containsPoint(player.position));
    }

    // Closing (or latching) on someone in the doorway would leave them inside
    // the blocker, free to walk through it.
    doorwayBlocked(bathroom) {
        for (const player of this.game.players.players.values()) {
            if (bathroom.inDoorway(player.position)) return true;
        }
        return false;
    }

    toggleDoor(bathroom) {
        if (bathroom.state.doorOpen && this.doorwayBlocked(bathroom)) {
            this.game.ui.chat?.addMessage({ type: 'system', message: '🚪 Hay alguien en la puerta.' });
            return;
        }
        this.send('bathroomDoor', bathroom, { inside: this.isInside(bathroom) });
    }

    toggleLatch(bathroom) {
        if (!bathroom.state.latchedBy && bathroom.state.doorOpen && this.doorwayBlocked(bathroom)) {
            this.game.ui.chat?.addMessage({ type: 'system', message: '🚪 Hay alguien en la puerta.' });
            return;
        }
        this.send('bathroomLatch', bathroom, { inside: this.isInside(bathroom) });
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

    snort(bathroom) {
        if (!bathroom.hasPowder()) {
            this.game.ui.chat?.addMessage({ type: 'system', message: '👃 No queda nada. Vuelve en un rato.' });
            return;
        }
        this.send('powderSnort', bathroom);
    }

    // --- Server events -----------------------------------------------------

    handleEvent({ roomId, kind, userId }) {
        const bathroom = this.bathroom(roomId);
        if (!bathroom) return;
        bathroom.playEvent(kind, this.game.environment.audioListener);
        const player = this.game.players.localPlayer;
        if (userId !== this.localId || !player) return;
        // Our line: lean in (everyone sees it through the gesture relay).
        if (kind === 'snort') {
            this.game.gestureSync.play('snort');
            return;
        }
        // Our own toilet visit: sit down (poo) or stand facing the bowl (pee),
        // only if we're still in there.
        if ((kind === 'pee' || kind === 'poo') && bathroom.containsPoint(player.position)) {
            const spot = kind === 'poo' ? bathroom.sitSpot : bathroom.standSpot;
            if (player.seat === spot) return;
            // Moving between the toilet's own spots keeps us its occupant.
            this.reseating = true;
            if (player.isSitting) player.standUp();
            this.reseating = false;
            player.sitDown(spot);
        }
    }

    // --- Per frame ------------------------------------------------------------

    update(deltaTime) {
        const { players, environment, serverClock } = this.game;
        const local = players.localPlayer;
        this.bathrooms.forEach(bathroom => {
            bathroom.listener = environment.audioListener;
            bathroom.update(deltaTime, serverClock);
            bathroom.setLocalInside(Boolean(local && bathroom.containsPoint(local.position)));
        });
        // Walked out with the toilet panel open: it no longer applies.
        if (this.panel.isOpen && this.panelBathroom && !this.isInside(this.panelBathroom)) this.panel.close();

        // Seated pose on any seat (chairs, stools, car, toilet): ours from our
        // seat (no round trip), everyone else's from userSat/userStood, or the
        // bathroom state for the toilet.
        const pooping = new Set();
        this.bathrooms.forEach(bathroom => {
            if (bathroom.state.occupant && bathroom.state.occupantKind === 'poo') pooping.add(bathroom.state.occupant);
        });
        players.players.forEach((player, id) => {
            const seated = player === local
                ? player.isSitting && player.seat?.userData.pose !== 'stand'
                : pooping.has(id) || player.seatPose === 'sit';
            player.setPose(seated ? 'sit' : null);
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
