import * as THREE from 'three';
import { BATHROOM_BOUNDS } from './Bathroom';

// The drawable walls inside each bathroom, one panel on each of its four
// walls, clear of every fixture (WALLS). A segment is [x0, y0, x1, y1,
// color, size] in 0..1 wall coordinates (x to the right as seen from
// inside, y down). The same canvas is the wall's texture and the drawing
// surface in the panel (GraffitiSync). Each wall's id is `<roomId>:<index>`.
export const GRAFFITI_COLORS = ['#111111', '#d32f2f', '#1565c0', '#2e7d32', '#d81b60', '#f9a825'];
export const WALL_COLOR = '#f4f4f0'; // the partition's white; also the eraser
export const ERASER = GRAFFITI_COLORS.length;
export const GRAFFITI_SIZES = [4, 10, 22]; // px on the canvas
export const MAX_SEGMENTS = 3000;
const TRIM_SLACK = 200; // segments over the cap before trimming (a trim redraws)
// Room-local: the panel's center a hair off the wall's inner face, its size,
// and its turn (facing into the cubicle; its +x is the viewer's right).
export const WALLS = [
    // The partition on the bar side (x -10).
    { x: BATHROOM_BOUNDS.maxX - 0.085, z: 7.45, y: 1.9, width: 4.1, height: 2, rotationY: -Math.PI / 2 },
    // The bar's side wall behind the toilet (x -15): above the tank and the paper.
    { x: BATHROOM_BOUNDS.minX + 0.11, z: 7.175, y: 2.2, width: 3.75, height: 1.4, rotationY: Math.PI / 2 },
    // The bar's front wall (z 10): right of the mirror, above the powder table.
    { x: -13.875, z: BATHROOM_BOUNDS.maxZ - 0.11, y: 2.025, width: 2.05, height: 1.75, rotationY: Math.PI },
    // The door's partition (z 5): left of the door as you face it from inside.
    { x: -13.475, z: BATHROOM_BOUNDS.minZ + 0.085, y: 1.9, width: 2.85, height: 2, rotationY: 0 }
];
const CANVAS_WIDTH = 1024;

export class GraffitiWall {
    constructor(bathroom, index) {
        this.bathroom = bathroom;
        this.index = index;
        this.wall = WALLS[index];
        this.segments = [];
    }

    get id() {
        return `${this.bathroom.room.id}:${this.index}`;
    }

    get width() {
        return CANVAS_WIDTH;
    }

    get height() {
        return Math.round(CANVAS_WIDTH * this.wall.height / this.wall.width);
    }

    create() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.className = 'graffiti-canvas';
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.anisotropy = 4;
        this.redraw();

        const { x, y, z, width, height, rotationY } = this.wall;
        const material = new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.6 });
        const wall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
        wall.rotation.y = rotationY;
        wall.position.set(x, y, z);
        wall.userData = {
            type: 'graffitiWall',
            bathroom: this.bathroom,
            graffiti: this,
            originalMaterial: material,
            highlightMaterial: new THREE.MeshStandardMaterial({ map: this.texture, emissive: 0x222222 })
        };
        this.mesh = wall;
        this.bathroom.group.add(wall);
    }

    // segment: [x0, y0, x1, y1, color, size]
    drawSegment(ctx, [x0, y0, x1, y1, color, size]) {
        ctx.strokeStyle = color === ERASER ? WALL_COLOR : GRAFFITI_COLORS[color] ?? GRAFFITI_COLORS[0];
        ctx.lineWidth = GRAFFITI_SIZES[size] ?? GRAFFITI_SIZES[0];
        ctx.beginPath();
        ctx.moveTo(x0 * this.width, y0 * this.height);
        ctx.lineTo(x1 * this.width, y1 * this.height);
        ctx.stroke();
    }

    redraw() {
        const ctx = this.canvas.getContext('2d');
        ctx.fillStyle = WALL_COLOR;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.lineCap = 'round';
        this.segments.forEach(segment => this.drawSegment(ctx, segment));
        this.texture.needsUpdate = true;
    }

    // Appends (drawing just those) and trims to MAX_SEGMENTS like the server,
    // in steps of TRIM_SLACK since a trim means a full redraw.
    addSegments(segments) {
        const ctx = this.canvas.getContext('2d');
        ctx.lineCap = 'round';
        segments.forEach(segment => {
            this.segments.push(segment);
            this.drawSegment(ctx, segment);
        });
        if (this.segments.length > MAX_SEGMENTS + TRIM_SLACK) {
            this.segments.splice(0, this.segments.length - MAX_SEGMENTS);
            this.redraw();
        }
        this.texture.needsUpdate = true;
    }

    setSegments(segments) {
        this.segments = segments.slice(-MAX_SEGMENTS);
        this.redraw();
    }
}
