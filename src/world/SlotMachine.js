import * as THREE from 'three';
import { playSynth, playTones } from '../audio/synth';

// The tragaperras against each bar's left wall: a video-game meme slot
// machine (server: server/features/slots.js rolls the reels and keeps the
// coins). Symbols are drawn in code (emoji on a loud tile, meme lettering:
// Impact, white with a black outline), no images. Everyone sees the same
// spin; the reels stop one after another on the server's result.
const POSITION = { x: -14.35, z: 2.6 }; // room-local, facing into the room (+x)
const SCREEN = { width: 1.16, height: 0.72, y: 1.78 };
const REEL_STOPS = [1.2, 1.7, 2.2]; // s after the pull
const REEL_SPEED = 14;              // symbols per second while spinning
const MESSAGE_TIME = 4;             // s the result stays on the screen
const MEME_FONT = 'Impact, "Arial Black", "Haettenschweiler", sans-serif';
export const BET = 10;

// Keep ids in sync with server/features/slots.js.
export const SYMBOLS = {
    leeroy: { emoji: '🐔', caption: 'LEEROY JENKINS', tile: ['#ff8a00', '#9c3d00'] },
    barrelroll: { emoji: '🛩️', caption: 'DO A BARREL ROLL', tile: ['#2fa8ff', '#0b4f8a'] },
    youdied: { emoji: '💀', caption: 'YOU DIED', tile: ['#4a0000', '#0d0000'], captionColor: '#ff2a2a' },
    takethis: { emoji: '🗡️', caption: 'TAKE THIS', tile: ['#2e9e3a', '#0f4a16'] },
    oneup: { emoji: '🍄', caption: '1UP', tile: ['#ff4d4d', '#9c1010'] },
    cake: { emoji: '🎂', caption: 'IS A LIE', tile: ['#f5a3c7', '#a33f73'] },
    pressf: { text: 'F', caption: 'PRESS F', tile: ['#5a5a5a', '#1e1e1e'] },
    ggez: { emoji: '🏆', caption: 'GG EZ', tile: ['#ffd400', '#c76a00'] }
};
const SYMBOL_IDS = Object.keys(SYMBOLS);

const TRIPLE_LINES = {
    ggez: 'GG EZ · JACKPOT',
    pressf: 'F · PRESS F TO PAY RESPECTS',
    oneup: '1UP 1UP 1UP',
    takethis: "IT'S DANGEROUS TO GO ALONE!",
    barrelroll: 'DO A BARREL ROLL!',
    leeroy: 'LEEEEEROY JENKINS!!!',
    cake: 'THE CAKE IS A LIE',
    youdied: 'YOU DIED'
};

// What the screen (and chat) says about a result.
export function describeResult(reels, win) {
    const [a, b, c] = reels;
    if (a === b && b === c) {
        const amount = win > 0 ? ` +${win}` : win < 0 ? ` ${win}` : ' (0)';
        return `${TRIPLE_LINES[a] ?? a}${amount}`;
    }
    if (win > 0) return `COMBO x2 +${win}`;
    return 'WASTED';
}

// How the screen shouts it: 'win', 'lose' (WASTED, YOU DIED) or 'jackpot'.
function resultTone(reels, win) {
    if (reels[0] === 'ggez' && reels[1] === 'ggez' && reels[2] === 'ggez') return 'jackpot';
    return win > 0 ? 'win' : 'lose';
}

export class SlotMachine {
    constructor(room) {
        this.room = room;
        this.reels = ['ggez', 'ggez', 'ggez'];
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
        ctx.font = `64px ${MEME_FONT}`;
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#000000';
        ctx.strokeText('🎰 TRAGAPERRAS', 256, 68, 490);
        ctx.fillText('🎰 TRAGAPERRAS', 256, 68, 490);
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
                this.messageTone = resultTone(spin.reels, spin.win);
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
        if (a === b && b === c && a === 'ggez') {
            const notes = [523, 659, 784, 1047, 784, 1047, 1319].map((f, i) => [f, i * 0.12, 0.16]);
            playTones(listener, this.group, at, notes, 0.25, 6);
        } else if (spin.win < 0 || (a === b && b === c && a === 'cake')) {
            playTones(listener, this.group, at, [[392, 0, 0.25], [370, 0.25, 0.25], [349, 0.5, 0.25], [330, 0.75, 0.6]], 0.2);
        } else if (spin.win > 0) {
            playTones(listener, this.group, at, [[659, 0, 0.1], [784, 0.1, 0.1], [1047, 0.2, 0.2]], 0.2);
        }
    }

    // --- Drawing ------------------------------------------------------------------

    // Meme lettering: white (or the symbol's color) with a thick black outline.
    memeText(ctx, text, x, y, size, color = '#ffffff', maxWidth = undefined) {
        ctx.font = `${size}px ${MEME_FONT}`;
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(3, size * 0.16);
        ctx.strokeStyle = '#000000';
        ctx.strokeText(text, x, y, maxWidth);
        ctx.fillStyle = color;
        ctx.fillText(text, x, y, maxWidth);
    }

    // One reel cell: a loud tile, the emoji (or a keyboard key), the caption.
    drawSymbol(ctx, id, x, y, cellWidth, cellHeight) {
        const symbol = SYMBOLS[id] ?? SYMBOLS.ggez;
        const gradient = ctx.createLinearGradient(0, y - cellHeight / 2, 0, y + cellHeight / 2);
        gradient.addColorStop(0, symbol.tile[0]);
        gradient.addColorStop(1, symbol.tile[1]);
        ctx.fillStyle = gradient;
        ctx.fillRect(x - cellWidth / 2, y - cellHeight / 2, cellWidth, cellHeight);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const size = cellHeight * 0.62;
        if (symbol.text) {
            ctx.fillStyle = '#e8e8e8';
            ctx.fillRect(x - size * 0.42, y - size * 0.62, size * 0.84, size * 0.8);
            ctx.fillStyle = '#9e9e9e';
            ctx.fillRect(x - size * 0.42, y + size * 0.1, size * 0.84, size * 0.08);
            ctx.fillStyle = '#111111';
            ctx.font = `${size * 0.62}px ${MEME_FONT}`;
            ctx.fillText(symbol.text, x, y - size * 0.22);
        } else {
            ctx.font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
            ctx.fillText(symbol.emoji, x, y - cellHeight * 0.1);
        }
        this.memeText(ctx, symbol.caption, x, y + cellHeight * 0.36, cellHeight * 0.17, symbol.captionColor, cellWidth - 8);
    }

    draw(time) {
        const ctx = this.canvas.getContext('2d');
        const { width, height } = this.canvas;
        ctx.fillStyle = '#120018';
        ctx.fillRect(0, 0, width, height);
        const reelWidth = 150;
        const reelHeight = 210;
        const top = 22;
        const cell = reelHeight * 0.75; // one symbol's height on a turning reel
        for (let i = 0; i < 3; i++) {
            const x = 31 + i * (reelWidth + 15);
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, top, reelWidth, reelHeight);
            ctx.clip();
            const centerX = x + reelWidth / 2;
            const centerY = top + reelHeight / 2;
            const turning = this.spin && i >= this.spin.stopped;
            if (turning) {
                // Symbols scrolling down.
                const position = time * REEL_SPEED + i * 3.3;
                const base = Math.floor(position);
                const offset = (position - base) * cell;
                for (let k = -2; k <= 1; k++) {
                    const id = SYMBOL_IDS[((base - k) % SYMBOL_IDS.length + SYMBOL_IDS.length) % SYMBOL_IDS.length];
                    this.drawSymbol(ctx, id, centerX, centerY + offset + k * cell, reelWidth, cell);
                }
            } else {
                this.drawSymbol(ctx, this.reels[i], centerX, centerY, reelWidth, reelHeight);
            }
            ctx.restore();
            ctx.strokeStyle = '#ffd400';
            ctx.lineWidth = 4;
            ctx.strokeRect(x, top, reelWidth, reelHeight);
        }
        // Bottom line: the result, shouted, or the price.
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const lineY = height - 42;
        if (this.messageTime > 0 && this.message) {
            if (this.messageTone === 'lose') {
                this.memeText(ctx, this.message, width / 2, lineY, 46, '#e3262f', width - 20);
            } else {
                const hue = (time * (this.messageTone === 'jackpot' ? 720 : 360)) % 360;
                this.memeText(ctx, this.message, width / 2, lineY, 38, `hsl(${hue}, 100%, 62%)`, width - 20);
            }
        } else if (this.spin) {
            this.memeText(ctx, `${this.spin.name} JUEGA…`, width / 2, lineY, 34, '#ffffff', width - 20);
        } else {
            this.memeText(ctx, `F: TIRAR · ${BET} 🪙`, width / 2, lineY, 38, '#ffd400', width - 20);
        }
        this.texture.needsUpdate = true;
    }
}
