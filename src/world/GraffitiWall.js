import * as THREE from 'three';
import { DOOR } from './Bathroom';

// The drawable walls inside each bathroom: each of its four walls is one
// panel, floor to ceiling and corner to corner (WALLS); the fixtures stand
// in front of them, and the door's wall has the doorway cut out. A segment
// is [x0, y0, x1, y1, color, size] in 0..1 wall coordinates (x to the right
// as seen from inside, y down). The same canvas is the wall's texture and
// the drawing surface in the panel (GraffitiSync), where the doorway shows
// shaded. Each wall's id is `<roomId>:<index>`.
export const GRAFFITI_COLORS = ['#111111', '#d32f2f', '#1565c0', '#2e7d32', '#d81b60', '#f9a825'];
export const WALL_COLOR = '#f4f4f0'; // the partition's white; also the eraser
export const ERASER = GRAFFITI_COLORS.length;
export const GRAFFITI_SIZES = [4, 10, 22]; // px on the canvas
export const MAX_SEGMENTS = 3000;
const TRIM_SLACK = 200; // segments over the cap before trimming (a trim redraws)
// The cubicle's inside (room-local): the walls' inner faces, the floor and
// the ceiling's underside.
const INSIDE = { minX: -14.9, maxX: -10.075, minZ: 5.075, maxZ: 9.9, floor: 0.01, ceiling: 3.04 };
const OFF_WALL = 0.01; // the panels sit this far in front of the walls
const SPAN_X = INSIDE.maxX - INSIDE.minX;
const SPAN_Z = INSIDE.maxZ - INSIDE.minZ;
const HEIGHT = INSIDE.ceiling - INSIDE.floor;
const MID_Y = (INSIDE.floor + INSIDE.ceiling) / 2;
// Room-local: each panel's center, size and turn (facing into the cubicle;
// its +x is the viewer's right). `opening`: the doorway, room-local x.
export const WALLS = [
    // The partition on the bar side (x -10).
    { x: INSIDE.maxX - OFF_WALL, z: (INSIDE.minZ + INSIDE.maxZ) / 2, y: MID_Y, width: SPAN_Z, height: HEIGHT, rotationY: -Math.PI / 2 },
    // The bar's side wall, behind the toilet (x -15).
    { x: INSIDE.minX + OFF_WALL, z: (INSIDE.minZ + INSIDE.maxZ) / 2, y: MID_Y, width: SPAN_Z, height: HEIGHT, rotationY: Math.PI / 2 },
    // The bar's front wall, with the mirror and the sink (z 10).
    { x: (INSIDE.minX + INSIDE.maxX) / 2, z: INSIDE.maxZ - OFF_WALL, y: MID_Y, width: SPAN_X, height: HEIGHT, rotationY: Math.PI },
    // The door's partition (z 5).
    {
        x: (INSIDE.minX + INSIDE.maxX) / 2, z: INSIDE.minZ + OFF_WALL, y: MID_Y, width: SPAN_X, height: HEIGHT, rotationY: 0,
        opening: { minX: DOOR.minX, maxX: DOOR.maxX, height: DOOR.height }
    }
];
const CANVAS_WIDTH = 1024;
const OPENING_COLOR = '#5b5f63';

export class GraffitiWall {
    constructor(bathroom, index) {
        this.bathroom = bathroom;
        this.index = index;
        this.wall = WALLS[index];
        this.opening = this.panelOpening();
        this.segments = [];
    }

    // The doorway in panel coordinates (x from the left edge, y up from the
    // bottom, both in meters), or null.
    panelOpening() {
        const { opening, x, rotationY, width } = this.wall;
        if (!opening) return null;
        // Along the panel's +x (the viewer's right): room-local x times cos(turn).
        const along = (roomX) => (roomX - x) * Math.cos(rotationY) + width / 2;
        const [from, to] = [along(opening.minX), along(opening.maxX)].sort((a, b) => a - b);
        return { from, to, top: opening.height - INSIDE.floor };
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
        const wall = new THREE.Mesh(this.createGeometry(width, height), material);
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

    // A plane, or with the doorway cut out of its bottom edge; the UVs span
    // the whole panel either way, so the canvas maps the same.
    createGeometry(width, height) {
        if (!this.opening) return new THREE.PlaneGeometry(width, height);
        const { from, to, top } = this.opening;
        const left = -width / 2;
        const bottom = -height / 2;
        const points = [
            [0, 0], [from, 0], [from, top], [to, top], [to, 0], [width, 0], [width, height], [0, height]
        ].map(([px, py]) => new THREE.Vector2(left + px, bottom + py));
        const geometry = new THREE.ShapeGeometry(new THREE.Shape(points));
        const position = geometry.attributes.position;
        const uv = geometry.attributes.uv;
        for (let i = 0; i < position.count; i++) {
            uv.setXY(i, (position.getX(i) - left) / width, (position.getY(i) - bottom) / height);
        }
        return geometry;
    }

    // Shades the doorway on the canvas (it isn't on the wall), so nobody
    // draws there by mistake.
    drawOpening(ctx) {
        if (!this.opening) return;
        const { from, to, top } = this.opening;
        const scaleX = this.width / this.wall.width;
        const scaleY = this.height / this.wall.height;
        const x = from * scaleX;
        const y = this.height - top * scaleY;
        ctx.fillStyle = OPENING_COLOR;
        ctx.fillRect(x, y, (to - from) * scaleX, top * scaleY);
        ctx.fillStyle = '#d0d3d6';
        ctx.font = `${Math.round(18 * this.width / 1024)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('puerta', x + ((to - from) * scaleX) / 2, y + (top * scaleY) / 2);
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
        this.drawOpening(ctx);
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
        this.drawOpening(ctx);
        this.texture.needsUpdate = true;
    }

    setSegments(segments) {
        this.segments = segments.slice(-MAX_SEGMENTS);
        this.redraw();
    }
}
