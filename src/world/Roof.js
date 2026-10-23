import * as THREE from 'three';
import { ROOM_HALF_WIDTH, ROOM_HALF_DEPTH, WALL_HEIGHT, WALL_THICKNESS } from './RoomLayout';

// A terracotta gable roof on each bar (room-local): two tiled slopes with
// eaves, the ridge along the bar's length, the gable ends closed like the
// outside walls (their finish, if any), a ridge cap and a brick chimney. Only for looking at from
// outside: World hides the roof of the bar you're in, so the inside keeps
// its open view. It casts no shadow (the bar's light inside is its own).
const OVERHANG = 0.8;
const RISE = 4.5;           // ridge height over the top of the walls
const TILE_THICKNESS = 0.25;
const TILE_COLOR = 0xb5532f;
const CHIMNEY = { x: 8, z: -4, size: 1.1 };

// outside: the walls' outside finish ({ material, finish }, World) or null.
export function createRoof(room, wallMaterial, outside = null) {
    const group = new THREE.Group();
    group.name = 'Roof';
    const tiles = new THREE.MeshStandardMaterial({ map: getTileTexture(), color: TILE_COLOR, roughness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x7a3420, roughness: 0.8 });
    const brick = new THREE.MeshStandardMaterial({ color: 0x8d4a3a, roughness: 0.9 });

    // The two slopes, from the ridge (z 0) down past the walls.
    const halfSpan = ROOM_HALF_DEPTH + OVERHANG;
    const angle = Math.atan2(RISE, ROOM_HALF_DEPTH);
    const slopeLength = halfSpan / Math.cos(angle);
    const ridgeY = WALL_HEIGHT + RISE;
    [-1, 1].forEach(side => {
        const slope = new THREE.Mesh(new THREE.BoxGeometry((ROOM_HALF_WIDTH + OVERHANG) * 2, TILE_THICKNESS, slopeLength), tiles);
        slope.rotation.x = side * angle;
        slope.position.set(0, ridgeY - (halfSpan / 2) * Math.tan(angle) + TILE_THICKNESS / 2, side * (halfSpan / 2));
        group.add(slope);
    });

    // Gable ends: the triangle between the side walls' tops and the ridge.
    const gable = new THREE.Shape([
        new THREE.Vector2(-ROOM_HALF_DEPTH, 0),
        new THREE.Vector2(ROOM_HALF_DEPTH, 0),
        new THREE.Vector2(0, RISE)
    ]);
    const gableGeometry = new THREE.ExtrudeGeometry(gable, { depth: WALL_THICKNESS, bevelEnabled: false });
    if (outside) {
        // The shape's UVs are in meters; continue the walls' pattern upward.
        const uv = gableGeometry.attributes.uv;
        for (let i = 0; i < uv.count; i++) {
            uv.setXY(i, uv.getX(i) / outside.finish.width, (uv.getY(i) + WALL_HEIGHT) / outside.finish.height);
        }
    }
    // Shape x → room z, extrusion → room x.
    gableGeometry.rotateY(Math.PI / 2);
    [-1, 1].forEach(side => {
        const end = new THREE.Mesh(gableGeometry, outside?.material ?? wallMaterial);
        end.position.set(side * ROOM_HALF_WIDTH - WALL_THICKNESS / 2, WALL_HEIGHT, 0);
        group.add(end);
    });

    // Ridge cap and chimney.
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, (ROOM_HALF_WIDTH + OVERHANG) * 2, 10), dark);
    cap.rotation.z = Math.PI / 2;
    cap.position.y = ridgeY + 0.12;
    group.add(cap);
    const chimneyBase = WALL_HEIGHT + RISE * (1 - Math.abs(CHIMNEY.z) / ROOM_HALF_DEPTH);
    const chimneyHeight = ridgeY + 1.4 - chimneyBase + 1;
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(CHIMNEY.size, chimneyHeight, CHIMNEY.size), brick);
    chimney.position.set(CHIMNEY.x, chimneyBase - 1 + chimneyHeight / 2, CHIMNEY.z);
    group.add(chimney);
    const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(CHIMNEY.size + 0.3, 0.18, CHIMNEY.size + 0.3), dark);
    chimneyCap.position.set(CHIMNEY.x, chimneyBase - 1 + chimneyHeight + 0.09, CHIMNEY.z);
    group.add(chimneyCap);

    group.traverse(object => {
        if (!object.isMesh) return;
        object.castShadow = false;
        object.receiveShadow = true;
    });
    room.add(group);
    return group;
}

// Rows of rounded clay tiles, a little uneven in color.
let tileTexture = null;
function getTileTexture() {
    if (tileTexture) return tileTexture;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const rows = 8;
    const columns = 8;
    const rowHeight = canvas.height / rows;
    const tileWidth = canvas.width / columns;
    ctx.fillStyle = '#9c4a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let row = 0; row < rows; row++) {
        const offset = row % 2 ? tileWidth / 2 : 0;
        for (let column = -1; column <= columns; column++) {
            const x = column * tileWidth + offset;
            const y = row * rowHeight;
            const shade = 200 + Math.floor(Math.random() * 40);
            const gradient = ctx.createLinearGradient(x, 0, x + tileWidth, 0);
            gradient.addColorStop(0, `rgb(${shade - 40}, ${Math.floor(shade * 0.42)}, ${Math.floor(shade * 0.28)})`);
            gradient.addColorStop(0.5, `rgb(${shade}, ${Math.floor(shade * 0.5)}, ${Math.floor(shade * 0.33)})`);
            gradient.addColorStop(1, `rgb(${shade - 50}, ${Math.floor(shade * 0.38)}, ${Math.floor(shade * 0.25)})`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(x + 2, y);
            ctx.lineTo(x + tileWidth - 2, y);
            ctx.lineTo(x + tileWidth - 2, y + rowHeight * 0.7);
            ctx.quadraticCurveTo(x + tileWidth / 2, y + rowHeight * 1.15, x + 2, y + rowHeight * 0.7);
            ctx.closePath();
            ctx.fill();
        }
    }
    tileTexture = new THREE.CanvasTexture(canvas);
    tileTexture.colorSpace = THREE.SRGBColorSpace;
    tileTexture.wrapS = tileTexture.wrapT = THREE.RepeatWrapping;
    tileTexture.repeat.set(10, 4);
    tileTexture.anisotropy = 4;
    return tileTexture;
}
