import * as THREE from 'three';

// "Didn't wash their hands": wavy green smell lines rising from both hands
// and a tag above the head. Added to a player's mesh by BathroomSync while
// the player has dirty hands and is outside a bathroom.

const TAG_TEXT = '🤢 No se ha lavado las manos';
const TAG_HEIGHT = 1.75; // above the avatar's center (scaled with the avatar)
// Roughly where the hands hang, in avatar space (see appearance/Accessories).
const HANDS = [new THREE.Vector3(-0.45, -0.5, 0.05), new THREE.Vector3(0.45, -0.5, 0.05)];
const LINES_PER_HAND = 3;
const RISE = 0.7; // how far a line rises before it fades out
const CYCLE = 1.6; // s per line

let lineTexture = null;
function getLineTexture() {
    if (lineTexture) return lineTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#9ccc3d';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let y = 60; y >= 4; y -= 2) {
        const x = 16 + Math.sin(y / 8) * 8;
        if (y === 60) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    lineTexture = new THREE.CanvasTexture(canvas);
    lineTexture.colorSpace = THREE.SRGBColorSpace;
    return lineTexture;
}

let tagTexture = null;
function getTagTexture() {
    if (tagTexture) return tagTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(80, 110, 20, 0.85)';
    ctx.beginPath();
    ctx.roundRect(40, 20, 944, 120, 60);
    ctx.fill();
    ctx.font = 'bold 72px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f1f8e9';
    ctx.fillText(TAG_TEXT, 512, 84);
    tagTexture = new THREE.CanvasTexture(canvas);
    tagTexture.colorSpace = THREE.SRGBColorSpace;
    return tagTexture;
}

export class Shame {
    constructor() {
        this.group = new THREE.Group();
        this.group.name = 'Shame';
        // Player.loadModel keeps it when the character changes.
        this.group.userData.keepOnModelSwap = true;
        this.time = 0;
        this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: getTagTexture(), depthTest: false, transparent: true }));
        this.tag.scale.set(2.2, 0.34, 1);
        this.tag.renderOrder = 1000;
        this.group.add(this.tag);
        this.lines = [];
        HANDS.forEach(hand => {
            for (let i = 0; i < LINES_PER_HAND; i++) {
                const line = new THREE.Sprite(new THREE.SpriteMaterial({ map: getLineTexture(), transparent: true, depthWrite: false }));
                line.scale.set(0.2, 0.4, 1);
                line.userData = { hand, offset: i / LINES_PER_HAND, side: (i - 1) * 0.08 };
                this.lines.push(line);
                this.group.add(line);
            }
        });
        // Signs, not targets.
        this.group.traverse(child => { child.raycast = () => {}; });
    }

    update(deltaTime, scale = 1) {
        this.time += Math.min(deltaTime, 0.1);
        this.tag.position.y = TAG_HEIGHT * scale;
        this.lines.forEach(line => {
            const { hand, offset, side } = line.userData;
            const phase = (this.time / CYCLE + offset) % 1;
            line.position.set(hand.x * scale + side, hand.y * scale + phase * RISE, hand.z);
            line.material.opacity = Math.sin(phase * Math.PI);
        });
    }

    dispose() {
        this.group.removeFromParent();
        this.group.traverse(child => child.material?.dispose());
    }
}
