import * as THREE from 'three';
import { BATHROOM_BOUNDS } from './Bathroom';

// The drawable wall inside each bathroom: the inner face of the partition
// on the bar side (room-local x -10), clear of every fixture. A segment is
// [x0, y0, x1, y1, color, size] in 0..1 wall coordinates (x to the right as
// seen from inside, y down). The same canvas is the wall's texture and the
// drawing surface in the panel (GraffitiSync).
export const GRAFFITI_COLORS = ['#111111', '#d32f2f', '#1565c0', '#2e7d32', '#d81b60', '#f9a825'];
export const WALL_COLOR = '#f4f4f0'; // the partition's white; also the eraser
export const ERASER = GRAFFITI_COLORS.length;
export const GRAFFITI_SIZES = [4, 10, 22]; // px on the canvas
export const MAX_SEGMENTS = 3000;
const TRIM_SLACK = 200; // segments over the cap before trimming (a trim redraws)
const WALL = { minZ: 5.4, maxZ: 9.5, minY: 0.9, maxY: 2.9 };
const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = Math.round(CANVAS_WIDTH * (WALL.maxY - WALL.minY) / (WALL.maxZ - WALL.minZ));

export class GraffitiWall {
    constructor(bathroom) {
        this.bathroom = bathroom;
        this.segments = [];
    }

    create() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
        this.canvas.className = 'graffiti-canvas';
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.anisotropy = 4;
        this.redraw();

        const width = WALL.maxZ - WALL.minZ;
        const height = WALL.maxY - WALL.minY;
        const material = new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.6 });
        const wall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
        // Facing into the cubicle (-x); its +x runs along +z, the viewer's right.
        wall.rotation.y = -Math.PI / 2;
        wall.position.set(BATHROOM_BOUNDS.maxX - 0.085, (WALL.minY + WALL.maxY) / 2, (WALL.minZ + WALL.maxZ) / 2);
        wall.userData = {
            type: 'graffitiWall',
            bathroom: this.bathroom,
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
        ctx.moveTo(x0 * CANVAS_WIDTH, y0 * CANVAS_HEIGHT);
        ctx.lineTo(x1 * CANVAS_WIDTH, y1 * CANVAS_HEIGHT);
        ctx.stroke();
    }

    redraw() {
        const ctx = this.canvas.getContext('2d');
        ctx.fillStyle = WALL_COLOR;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
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
