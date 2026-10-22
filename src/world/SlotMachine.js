import * as THREE from 'three';
import { playSynth, playTones } from '../audio/synth';

// The meme slot machine against each bar's left wall (server:
// server/features/slots.js rolls the reels and keeps the coins). Symbols are
// drawn in code: emoji plus a caption, no images. Everyone sees the same
// spin; the reels stop one after another on the server's result.
const POSITION = { x: -14.35, z: 2.6 }; // room-local, facing into the room (+x)
const SCREEN = { width: 1.0, height: 0.62, y: 1.75 };
const REEL_STOPS = [1.2, 1.7, 2.2]; // s after the pull
const REEL_SPEED = 14;              // symbols per second while spinning
const MESSAGE_TIME = 4;             // s the result stays on the screen
export const BET = 10;

// Keep ids in sync with server/features/slots.js.
export const SYMBOLS = {
    moai: { emoji: '🗿', caption: 'MOAI' },
    clown: { emoji: '🤡', caption: 'PAYASO' },
    skull: { emoji: '💀', caption: 'RIP' },
    doge: { emoji: '🐕', caption: 'MUCH WOW' },
    oneup: { emoji: '🍄', caption: '1UP' },
    cake: { emoji: '🎂', caption: 'IS A LIE' },
    pressf: { text: 'F', caption: 'PRESS F' },
    stonks: { emoji: '📈', caption: 'STONKS' }
};
const SYMBOL_IDS = Object.keys(SYMBOLS);

// What the screen (and chat) says about a result.
export function describeResult(reels, win) {
    const [a, b, c] = reels;
    if (a === b && b === c) {
        const lines = {
            stonks: '📈📈📈 ¡STONKS! JACKPOT',
            pressf: 'F F F · Press F to pay respects',
            oneup: '🍄 1UP 1UP 1UP',
            doge: 'such money · much wow',
            clown: '🤡 Payasos al poder',
            moai: '🗿🗿🗿',
            cake: 'The cake is a lie (0)',
            skull: '💀 Te has quedado sin alma'
        };
        return `${lines[a]} ${win > 0 ? `+${win}` : win < 0 ? win : ''}`.trim();
    }
    if (win > 0) return `¡Pareja! +${win}`;
    return 'Nada. Otra, ¿no?';
}

export class SlotMachine {
    constructor(room) {
        this.room = room;
        this.reels = ['stonks', 'stonks', 'stonks'];
        this.spin = null; // { time, result, win, userId, name, coins, bailout }
        this.message = '';
        this.messageTime = 0;
        this.lever = 0; // 0..1 pulled
    }

    get id() {
        return this.room.id;
    }

    create() {
        const group = new THREE.Group();
        group.position.set(POSITION.x, 0, POSITION.z);
        group.rotation.y = Math.PI / 2; // its front (+z) faces into the room
        const body = new THREE.MeshStandardMaterial({ color: 0xb71c1c, metalness: 0.4, roughness: 0.4 });
        const gold = new THREE.MeshStandardMaterial({ color: 0xffc107, metalness: 0.8, roughness: 0.3 });
        const highlight = new THREE.MeshStandardMaterial({ color: 0x7fff7f, emissive: 0x2f2f2f });

        const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.3, 0.9), body);
        cabinet.position.y = 1.15;
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.35), gold);
        shelf.position.set(0, 1.2, 0.55);

        // Screen: the reels, drawn on a canvas.
        this.canvas = document.createElement('canvas');
        this.canvas.width = 512;
        this.canvas.height = 320;
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        const screen = new THREE.Mesh(
            new THREE.PlaneGeometry(SCREEN.width, SCREEN.height),
            new THREE.MeshBasicMaterial({ map: this.texture })
        );
        screen.position.set(0, SCREEN.y, 0.451);
        screen.userData.keepMaterial = true;

        // Lit sign on top.
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 512;
        signCanvas.height = 128;
        const ctx = signCanvas.getContext('2d');
        ctx.fillStyle = '#1a0033';
        ctx.fillRect(0, 0, 512, 128);
        ctx.font = 'bold 64px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffeb3b';
        ctx.fillText('🎰 MEME SLOTS', 256, 68);
        const signTexture = new THREE.CanvasTexture(signCanvas);
        signTexture.colorSpace = THREE.SRGBColorSpace;
        const sign = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.35, 0.3),
            [body, body, body, body, new THREE.MeshBasicMaterial({ map: signTexture }), body]);
        sign.position.set(0, 2.48, 0.15);

        // Lever on the right side (the player's right as they face it).
        this.leverPivot = new THREE.Group();
        this.leverPivot.position.set(0.72, 1.4, 0.1);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 10), gold);
        arm.position.y = 0.3;
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), new THREE.MeshStandardMaterial({ color: 0xd50000 }));
        knob.position.y = 0.62;
        this.leverPivot.add(arm, knob);

        group.add(cabinet, shelf, screen, sign, this.leverPivot);
        group.traverse(child => {
            if (!child.isMesh || child === screen || child === sign) return;
            child.userData.originalMaterial = child.material;
            child.userData.highlightMaterial = highlight;
        });
        group.userData = { type: 'slotMachine', machine: this };
        this.group = group;
        this.room.add(group);
        group.updateMatrixWorld(true);
        window.game?.world?.collisionManager?.addCollider(cabinet);
        this.draw(0);
    }

    // The server's result: spin everyone's reels to it.
    startSpin(result) {
        this.spin = { ...result, time: 0, stopped: 0 };
        this.lever = 1;
        this.message = '';
        const listener = window.game?.environment.audioListener;
        if (listener) playSynth(listener, this.group, new THREE.Vector3(0.72, 1.6, 0.2), 'latch', 3);
    }

    isSpinning() {
        return Boolean(this.spin);
    }

    // Who's close enough to hear it.
    distanceTo(worldPosition) {
        const here = this.group.getWorldPosition(new THREE.Vector3());
        return Math.hypot(here.x - worldPosition.x, here.z - worldPosition.z);
    }

    update(deltaTime, onDone) {
        const dt = Math.min(deltaTime, 0.1);
        this.lever = Math.max(0, this.lever - dt * 2.5);
        this.leverPivot.rotation.x = this.lever * 1.1;
        const showingMessage = this.messageTime > 0;
        if (showingMessage) this.messageTime -= dt;

        const spin = this.spin;
        if (spin) {
            spin.time += dt;
            const listener = window.game?.environment.audioListener;
            while (spin.stopped < 3 && spin.time >= REEL_STOPS[spin.stopped]) {
                this.reels[spin.stopped] = spin.reels[spin.stopped];
                spin.stopped += 1;
                if (listener) playSynth(listener, this.group, new THREE.Vector3(0, SCREEN.y, 0.5), 'dart', 3);
            }
            if (spin.stopped === 3) {
                this.spin = null;
                this.message = describeResult(spin.reels, spin.win);
                this.messageTime = MESSAGE_TIME;
                if (listener) this.playResult(listener, spin);
                onDone?.(spin);
            }
        }
        // Idle screens are drawn once, not every frame.
        if (this.spin || showingMessage || !this.idleDrawn) {
            this.idleDrawn = !this.spin && this.messageTime <= 0;
            this.draw(performance.now() / 1000);
        }
    }

    playResult(listener, spin) {
        const at = new THREE.Vector3(0, SCREEN.y, 0.5);
        const [a, b, c] = spin.reels;
        if (a === b && b === c && a === 'stonks') {
            const notes = [523, 659, 784, 1047, 784, 1047, 1319].map((f, i) => [f, i * 0.12, 0.16]);
            playTones(listener, this.group, at, notes, 0.25, 6);
        } else if (spin.win < 0 || (a === b && b === c && a === 'cake')) {
            playTones(listener, this.group, at, [[392, 0, 0.25], [370, 0.25, 0.25], [349, 0.5, 0.25], [330, 0.75, 0.6]], 0.2);
        } else if (spin.win > 0) {
            playTones(listener, this.group, at, [[659, 0, 0.1], [784, 0.1, 0.1], [1047, 0.2, 0.2]], 0.2);
        }
    }

    // --- Drawing ------------------------------------------------------------------

    drawSymbol(ctx, id, x, y, size) {
        const symbol = SYMBOLS[id] ?? SYMBOLS.moai;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (symbol.text) {
            // A keyboard key with the letter.
            ctx.fillStyle = '#e0e0e0';
            ctx.fillRect(x - size * 0.42, y - size * 0.5, size * 0.84, size * 0.8);
            ctx.fillStyle = '#212121';
            ctx.font = `bold ${size * 0.6}px Arial`;
            ctx.fillText(symbol.text, x, y - size * 0.1);
        } else {
            ctx.font = `${size * 0.75}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
            ctx.fillText(symbol.emoji, x, y - size * 0.1);
        }
        ctx.fillStyle = '#ffeb3b';
        ctx.font = `bold ${size * 0.18}px Arial`;
        ctx.fillText(symbol.caption, x, y + size * 0.48);
    }

    draw(time) {
        const ctx = this.canvas.getContext('2d');
        const { width, height } = this.canvas;
        ctx.fillStyle = '#120018';
        ctx.fillRect(0, 0, width, height);
        const reelWidth = 150;
        const reelHeight = 210;
        const top = 22;
        for (let i = 0; i < 3; i++) {
            const x = 31 + i * (reelWidth + 15);
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, top, reelWidth, reelHeight);
            ctx.clip();
            ctx.fillStyle = '#fffde7';
            ctx.fillRect(x, top, reelWidth, reelHeight);
            const centerX = x + reelWidth / 2;
            const centerY = top + reelHeight / 2;
            const turning = this.spin && i >= this.spin.stopped;
            if (turning) {
                // Symbols scrolling down.
                const position = time * REEL_SPEED + i * 3.3;
                const base = Math.floor(position);
                const offset = (position - base) * reelHeight * 0.75;
                for (let k = -1; k <= 1; k++) {
                    const id = SYMBOL_IDS[((base - k) % SYMBOL_IDS.length + SYMBOL_IDS.length) % SYMBOL_IDS.length];
                    this.drawSymbol(ctx, id, centerX, centerY + offset + k * reelHeight * 0.75, 120);
                }
            } else {
                this.drawSymbol(ctx, this.reels[i], centerX, centerY, 130);
            }
            ctx.restore();
        }
        // Bottom line: the result, or the price.
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 30px "Segoe UI", sans-serif';
        if (this.messageTime > 0 && this.message) {
            ctx.fillStyle = `hsl(${(time * 360) % 360}, 100%, 65%)`;
            ctx.fillText(this.message, width / 2, height - 42);
        } else if (this.spin) {
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${this.spin.name} juega…`, width / 2, height - 42);
        } else {
            ctx.fillStyle = '#ffeb3b';
            ctx.fillText(`F: tirar de la palanca · ${BET} 🪙`, width / 2, height - 42);
        }
        this.texture.needsUpdate = true;
    }
}
