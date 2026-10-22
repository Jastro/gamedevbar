import * as THREE from 'three';

// A sign above the door inside each bar: Madrid time and the weather outside
// ("21:43 · 🌧️ 14°C · Madrid"), redrawn when the text changes. Room-local.
const POSITION = { x: 0, y: 4.2, z: 9.86 }; // inner face of the front wall, above the door
const SIZE = { width: 3.4, height: 0.85 };

export class WallClock {
    constructor(room) {
        this.room = room;
        this.text = '';
    }

    create() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 512;
        this.canvas.height = 128;
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(SIZE.width, SIZE.height),
            new THREE.MeshBasicMaterial({ map: this.texture })
        );
        sign.position.set(POSITION.x, POSITION.y, POSITION.z);
        sign.rotation.y = Math.PI; // facing into the room (-z)
        sign.raycast = () => {};
        this.room.add(sign);
    }

    // label: { time, weather } from Weather.label().
    update(label) {
        const text = `${label.time}|${label.weather}`;
        if (text === this.text) return;
        this.text = text;
        const ctx = this.canvas.getContext('2d');
        const { width, height } = this.canvas;
        ctx.fillStyle = '#14100c';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#dc5a0b';
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, width - 6, height - 6);
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 64px "Courier New", monospace';
        ctx.fillStyle = '#ffb347';
        ctx.textAlign = 'left';
        ctx.fillText(label.time, 24, 68);
        ctx.font = '40px "Segoe UI", sans-serif';
        ctx.fillStyle = '#f5f5f5';
        ctx.textAlign = 'right';
        ctx.fillText(label.weather, width - 24, 54);
        ctx.font = '20px "Segoe UI", sans-serif';
        ctx.fillStyle = '#b0a090';
        ctx.fillText('Madrid', width - 24, 96);
        this.texture.needsUpdate = true;
    }
}
