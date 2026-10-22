import * as THREE from 'three';
import { FloatingPanel } from '../ui/FloatingPanel';
import { playSynth } from '../audio/synth';
import { DRINKS, getDrink, drunkLevelAt, MAX_DRUNK } from './drinks';

// Ordering at the tap, drinking (B), and being drunk. The server owns what
// everyone holds and their drunk level (server/features/drinks.js); here:
// the drink in hand, the "Borracho/a" tag over drunk players, and for the
// local player the effects (camera sway, walking drift, slurred chat).

const SIP_KEY = 'b';
const TAG_LEVEL = 3; // tag shows from this level
// Effects scale from 0 at level EFFECT_START to 1 at MAX_DRUNK.
const EFFECT_START = 1.5;
const TAG_HEIGHT = 2.1;

let tagTexture = null;
function getTagTexture() {
    if (tagTexture) return tagTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(140, 70, 0, 0.85)';
    ctx.beginPath();
    ctx.roundRect(24, 16, 464, 96, 48);
    ctx.fill();
    ctx.font = 'bold 60px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff3e0';
    ctx.fillText('🍺 Borracho/a', 256, 68);
    tagTexture = new THREE.CanvasTexture(canvas);
    tagTexture.colorSpace = THREE.SRGBColorSpace;
    tagTexture.userData.shared = true;
    return tagTexture;
}

export class DrinkSync {
    constructor(game) {
        this.game = game;
        this.states = new Map(); // userId -> { drink, sips, drunk, at }
        this.tags = new Map(); // userId -> Sprite
        this.createPanel();
        window.addEventListener('keydown', (event) => {
            if (event.key.toLowerCase() !== SIP_KEY || event.repeat || this.game.chatActive || this.game.playMode) return;
            this.sip();
        });
    }

    get localId() {
        return this.game.players.localPlayer?.id;
    }

    createPanel() {
        this.panel = new FloatingPanel('drinks-panel', '🍺 ¿Qué te pongo?');
        const grid = document.createElement('div');
        grid.className = 'customize-items';
        DRINKS.forEach(drink => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'customize-item';
            const icon = document.createElement('span');
            icon.className = 'customize-item-icon';
            icon.textContent = drink.icon;
            const label = document.createElement('span');
            label.textContent = drink.name;
            button.append(icon, label);
            button.addEventListener('click', () => {
                this.panel.close();
                this.game.network.send('drinkOrder', { drink: drink.id });
            });
            grid.appendChild(button);
        });
        const note = document.createElement('div');
        note.className = 'floating-panel-note';
        note.textContent = 'B para beber. Con moderación… o no.';
        this.panel.body.append(grid, note);
    }

    bind() {
        const { network } = this.game;
        network.on('drinkStates', (data) => {
            (Array.isArray(data.states) ? data.states : []).forEach(state => this.applyState(state));
        });
        network.on('drinkState', (data) => this.applyState(data));
        network.on('drinkSipped', (data) => {
            const player = this.game.players.players.get(data.userId);
            const listener = this.game.environment.audioListener;
            if (player && listener) playSynth(listener, player.mesh, new THREE.Vector3(0, 0.3, 0.3), 'sip', 2);
        });
        network.on('userLeft', (data) => {
            this.states.delete(data.userId);
            const tag = this.tags.get(data.userId);
            tag?.removeFromParent();
            tag?.material.dispose();
            this.tags.delete(data.userId);
        });
    }

    applyState({ userId, drink, sips, drunk, at }) {
        if (typeof userId !== 'string') return;
        const previous = this.states.get(userId);
        drink = getDrink(drink)?.id ?? null;
        this.states.set(userId, { drink, sips: sips ?? 0, drunk: Number(drunk) || 0, at: Number(at) || 0 });
        if (userId === this.localId && drink && previous?.drink !== drink) {
            this.game.ui.chat?.addMessage({ type: 'system', message: `${getDrink(drink).icon} Marchando. Pulsa B para beber.` });
        }
    }

    openMenu() {
        this.panel.open();
    }

    sip() {
        const state = this.states.get(this.localId);
        if (!state?.drink) return;
        this.game.network.send('drinkSip', {});
    }

    // Current drunk level of a player (0..MAX_DRUNK).
    levelOf(userId) {
        const state = this.states.get(userId);
        if (!state) return 0;
        return drunkLevelAt(state.drunk, state.at, this.game.serverClock.now());
    }

    // 0..1: how strong the local effects are.
    get effect() {
        const level = this.levelOf(this.localId);
        return Math.min(1, Math.max(0, (level - EFFECT_START) / (MAX_DRUNK - EFFECT_START)));
    }

    // Garbled chat at higher levels: doubled vowels, swapped letters, "hic".
    slur(message) {
        const level = this.levelOf(this.localId);
        if (level < 2) return message;
        const chance = Math.min(0.35, (level - 1) * 0.06);
        let out = '';
        const chars = [...message];
        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            const roll = Math.random();
            if (/[aeiouáéíóú]/i.test(char) && roll < chance) {
                out += char + char;
            } else if (roll < chance / 2 && /[a-zñ]/i.test(char) && /[a-zñ]/i.test(chars[i + 1] ?? '')) {
                out += chars[i + 1] + char;
                i++;
            } else {
                out += char;
            }
        }
        if (level >= 4 && Math.random() < 0.5) out += ' *hic*';
        return out;
    }

    update() {
        const { players } = this.game;
        players.players.forEach((player, id) => {
            const state = this.states.get(id);
            player.setHeldItem(state?.drink ? getDrink(state.drink).item : null);

            const drunk = this.levelOf(id) >= TAG_LEVEL;
            let tag = this.tags.get(id);
            if (drunk && !tag) {
                tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: getTagTexture(), depthTest: false, transparent: true }));
                tag.scale.set(1.3, 0.33, 1);
                tag.renderOrder = 1000;
                tag.userData.keepOnModelSwap = true;
                tag.raycast = () => {};
                this.tags.set(id, tag);
            } else if (!drunk && tag) {
                tag.removeFromParent();
                tag.material.dispose();
                this.tags.delete(id);
                tag = null;
            }
            if (tag) {
                if (tag.parent !== player.mesh) player.mesh.add(tag);
                tag.position.y = TAG_HEIGHT * (player.appearance?.scale ?? 1);
            }
        });
        this.game.camera.drunk = this.effect;
    }
}
