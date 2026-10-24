import * as THREE from 'three';
import { PLAZA_CENTER } from './RoomLayout';

// A big sign over the fountain: "Mediavida" with the forum's logo below it
// (public/assets/brand/mediavida-logo.svg, the forum's own one-color icon,
// painted orange here), turning slowly on a mast that rises from the
// fountain's top. The angle comes from the server clock, so everyone sees it
// facing the same way. Lit like a billboard (not by the sun).
const LOGO_URL = '/assets/brand/mediavida-logo.svg';
const MAST = { bottom: 4.6, radius: 0.12 };   // from the fountain's finial
const BOARD = { width: 9, height: 6.75, bottom: 8.6, depth: 0.25 };
const CANVAS = { width: 1024, height: 768 };
const TURN_SPEED = 0.25; // rad/s
const ORANGE = '#ff7f00';
const BACKGROUND = '#1d1f23';

export class MediavidaSign {
    constructor(game) {
        this.game = game;
    }

    create() {
        const group = new THREE.Group();
        group.position.set(PLAZA_CENTER.x, 0, PLAZA_CENTER.z);
        this.game.scene.getScene().add(group);

        const metal = new THREE.MeshStandardMaterial({ color: 0x2f3337, metalness: 0.6, roughness: 0.5 });
        const mastHeight = BOARD.bottom - MAST.bottom + 0.4;
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(MAST.radius, MAST.radius * 1.3, mastHeight, 12), metal);
        mast.position.y = MAST.bottom + mastHeight / 2;
        group.add(mast);

        // The turning part: a frame and the same face on both sides.
        this.board = new THREE.Group();
        this.board.position.y = BOARD.bottom + BOARD.height / 2;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(BOARD.width + 0.3, BOARD.height + 0.3, BOARD.depth), metal);
        this.board.add(frame);
        this.canvas = document.createElement('canvas');
        this.canvas.width = CANVAS.width;
        this.canvas.height = CANVAS.height;
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.anisotropy = 8;
        const face = new THREE.MeshBasicMaterial({ map: this.texture });
        face.userData.outlineParameters = { visible: false };
        [1, -1].forEach(side => {
            const plane = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.width, BOARD.height), face);
            plane.position.z = side * (BOARD.depth / 2 + 0.01);
            if (side < 0) plane.rotation.y = Math.PI;
            this.board.add(plane);
        });
        group.add(this.board);
        group.traverse(child => { child.raycast = () => {}; });

        this.draw(null);
        const logo = new Image();
        logo.onload = () => this.draw(logo);
        logo.src = LOGO_URL;
    }

    // The name on top, the logo (tinted orange) below.
    draw(logo) {
        const context = this.canvas.getContext('2d');
        const { width, height } = CANVAS;
        context.fillStyle = BACKGROUND;
        context.fillRect(0, 0, width, height);
        context.strokeStyle = ORANGE;
        context.lineWidth = 18;
        context.strokeRect(9, 9, width - 18, height - 18);
        context.fillStyle = '#ffffff';
        context.font = 'bold 168px "Segoe UI", Arial, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('Mediavida', width / 2, 170, width - 80);
        if (!logo) {
            this.texture.needsUpdate = true;
            return;
        }
        // Tint: draw the black logo on its own canvas, then fill over it
        // keeping only the logo's shape.
        const size = 440;
        const tinted = document.createElement('canvas');
        tinted.width = tinted.height = size;
        const tint = tinted.getContext('2d');
        tint.drawImage(logo, 0, 0, size, size);
        tint.globalCompositeOperation = 'source-in';
        tint.fillStyle = ORANGE;
        tint.fillRect(0, 0, size, size);
        context.drawImage(tinted, (width - size) / 2, 290);
        this.texture.needsUpdate = true;
    }

    update() {
        if (!this.board) return;
        const seconds = this.game.serverClock.now() / 1000;
        this.board.rotation.y = (seconds * TURN_SPEED) % (Math.PI * 2);
    }
}
