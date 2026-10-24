import * as THREE from 'three';
import { RemotePlayer } from '../entities/RemotePlayer';
import { playTones } from '../audio/synth';

// Agente Porras, the plaza's policeman (server: server/features/police.js
// walks him and picks who to chase). Here: his avatar following the
// server's pose, his lines as speech bubbles, a whistle when a chase
// starts, and whoever he's after gets his lines in their chat too (he may
// be behind them). Hidden while you're in a bar with its door shut (his
// name and bubbles show through walls).
const NAME = 'Agente Porras 🚓';
const MODEL = 'pj'; // pj6 has a pointed hat of its own
const LOOK = { head: 'police-cap', face: 'mustache', hand: 'baton', scale: 1.1 };
// A police whistle: two short trills.
const WHISTLE = [[2900, 0, 0.12], [2500, 0.14, 0.12], [2900, 0.28, 0.12], [2500, 0.42, 0.3]];

export class PoliceSync {
    constructor(game) {
        this.game = game;
        this.state = null;
        this.npc = new RemotePlayer('npc:police', new THREE.Vector3(0, 1, 0), game);
        this.npc.mesh.visible = false; // until the first state
        this.npc.setModel(MODEL).then(() => {
            this.npc.setUsername(NAME);
            this.npc.setAppearance({ ...this.npc.appearance, ...LOOK });
        });
    }

    bind() {
        const { network } = this.game;
        network.on('policeState', (data) => this.applyState(data));
        network.on('policeSay', (data) => {
            if (typeof data.line !== 'string') return;
            this.npc.showChatBubble(data.line);
            const toMe = data.targetId && data.targetId === this.game.players.localPlayer?.id;
            if (toMe && !data.final) this.game.ui.chat?.addMessage({ type: 'system', message: `🚓 Agente Porras: ${data.line}` });
        });
    }

    get chasingMe() {
        return Boolean(this.state?.targetId) && this.state.targetId === this.game.players.localPlayer?.id;
    }

    applyState(data) {
        const first = !this.state;
        const previous = this.state?.phase;
        this.state = data;
        const position = new THREE.Vector3(Number(data.x) || 0, 1, Number(data.z) || 0);
        this.npc.targetPosition.copy(position);
        this.npc.targetRotation = Number(data.yaw) || 0;
        if (first) {
            this.npc.position.copy(position);
            this.npc.mesh.position.copy(position);
        }
        if (data.phase === 'chase' && previous === 'patrol') {
            const listener = this.game.environment.audioListener;
            if (listener) playTones(listener, this.npc.mesh, new THREE.Vector3(0, 1.6, 0), WHISTLE, 0.12, 10);
            if (this.chasingMe) this.game.ui.chat?.addMessage({ type: 'system', message: '🚓 ¡El Agente Porras va a por ti! Corre (Mayús) o déjate cachear.' });
        }
    }

    update(deltaTime) {
        if (!this.state) return;
        this.npc.update(deltaTime);
        const player = this.game.players.localPlayer;
        const here = player ? this.game.world.getRoomAt(player.position) : null;
        const doorOpen = here ? this.game.environment.rooms.get(here.id)?.door.angle !== 0 : true;
        this.npc.mesh.visible = !here || doorOpen;
    }
}
