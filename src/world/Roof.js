import * as THREE from 'three';
import { ROOM_HALF_WIDTH, ROOM_HALF_DEPTH, WALL_HEIGHT, WALL_THICKNESS } from './RoomLayout';
import { litAsOutside } from '../rendering/RegionLights';

// A terracotta gable roof on each bar (room-local): two tiled slopes with
// eaves, the ridge along the bar's length, the gable ends closed like the
// outside walls (their finish, if any), a ridge cap and a brick chimney.
// From inside it's a sloped wooden ceiling, and the gable ends are plaster.
// The bar's light space reaches up to ROOF_TOP, so the ceiling takes the
// bar's light; everything on the outside is lit as outside (litAsOutside).
// It casts no shadow (the bar's light inside is its own).
const OVERHANG = 0.8;
const RISE = 4.5;           // ridge height over the top of the walls
export const ROOF_TOP = WALL_HEIGHT + RISE + 2.5; // above the chimney
const TILE_THICKNESS = 0.25;
const TILE_COLOR = 0xb5532f;
const CHIMNEY = { x: 8, z: -4, size: 1.1 };

// outside: the walls' outside finish ({ material, finish }, World) or null.
export function createRoof(room, wallMaterial, outside = null) {
    const group = new THREE.Group();
    group.name = 'Roof';
    const tiles = litAsOutside(new THREE.MeshStandardMaterial({ map: getTileTexture(), color: TILE_COLOR, roughness: 0.85 }));
    const dark = litAsOutside(new THREE.MeshStandardMaterial({ color: 0x7a3420, roughness: 0.8 }));
    const brick = litAsOutside(new THREE.MeshStandardMaterial({ color: 0x8d4a3a, roughness: 0.9 }));
    const ceiling = new THREE.MeshStandardMaterial({ map: getBoardTexture(), roughness: 0.8 });
    const slopes = [];

    // The two slopes, from the ridge (z 0) down past the walls.
    const halfSpan = ROOM_HALF_DEPTH + OVERHANG;
    const angle = Math.atan2(RISE, ROOM_HALF_DEPTH);
    const slopeLength = halfSpan / Math.cos(angle);
    const ridgeY = WALL_HEIGHT + RISE;
    [-1, 1].forEach(side => {
        // Tiles on top and round the edges, boards underneath (-y).
        const geometry = new THREE.BoxGeometry((ROOM_HALF_WIDTH + OVERHANG) * 2, TILE_THICKNESS, slopeLength);
        const slope = new THREE.Mesh(geometry, [tiles, tiles, tiles, ceiling, tiles, tiles]);
        slope.rotation.x = side * angle;
        slope.position.set(0, ridgeY - (halfSpan / 2) * Math.tan(angle) + TILE_THICKNESS / 2, side * (halfSpan / 2));
        group.add(slope);
        slopes.push(slope);
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
    // Their inner faces: plain plaster, a hair inside.
    const innerGeometry = new THREE.ShapeGeometry(gable);
    [-1, 1].forEach(side => {
        const end = new THREE.Mesh(gableGeometry, outside?.material ?? wallMaterial);
        end.position.set(side * ROOM_HALF_WIDTH - WALL_THICKNESS / 2, WALL_HEIGHT, 0);
        group.add(end);
        const inner = new THREE.Mesh(innerGeometry, wallMaterial);
        // The shape faces +z; turned to face the middle of the room.
        inner.rotation.y = -side * Math.PI / 2;
        inner.position.set(side * (ROOM_HALF_WIDTH - WALL_THICKNESS / 2 - 0.01), WALL_HEIGHT, 0);
        group.add(inner);
    });

    // Ridge cap and chimney.
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, (ROOM_HALF_WIDTH + OVERHANG) * 2, 10), dark);
    cap.rotation.z = Math.PI / 2;
    cap.position.y = ridgeY + 0.12;
    group.add(cap);
    const chimneyBase = WALL_HEIGHT + RISE * (1 - Math.abs(CHIMNEY.z) / ROOM_HALF_DEPTH);
    // From just above the ceiling boards, so it doesn't poke through inside.
    const chimneyBottom = chimneyBase + 0.05;
    const chimneyHeight = ridgeY + 1.4 - chimneyBottom;
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(CHIMNEY.size, chimneyHeight, CHIMNEY.size), brick);
    chimney.position.set(CHIMNEY.x, chimneyBottom + chimneyHeight / 2, CHIMNEY.z);
    group.add(chimney);
    const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(CHIMNEY.size + 0.3, 0.18, CHIMNEY.size + 0.3), dark);
    chimneyCap.position.set(CHIMNEY.x, chimneyBottom + chimneyHeight + 0.09, CHIMNEY.z);
    group.add(chimneyCap);

    group.traverse(object => {
        if (!object.isMesh) return;
        object.castShadow = false;
        object.receiveShadow = true;
    });
    // The camera stays under the ceiling (World adds them to its occluders).
    group.userData.slopes = slopes;
    room.add(group);
    return group;
}

// Ceiling boards: long planks, a little uneven in color.
let boardTexture = null;
function getBoardTexture() {
    if (boardTexture) return boardTexture;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const boards = 8;
    const height = canvas.height / boards;
    for (let i = 0; i < boards; i++) {
        const shade = 0.85 + Math.random() * 0.25;
        ctx.fillStyle = `rgb(${Math.round(150 * shade)}, ${Math.round(98 * shade)}, ${Math.round(58 * shade)})`;
        ctx.fillRect(0, i * height, canvas.width, height - 2);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, i * height + height - 2, canvas.width, 2);
        for (let g = 0; g < 6; g++) {
            ctx.fillStyle = `rgba(0,0,0,${0.12 * Math.random()})`;
            ctx.fillRect(Math.random() * canvas.width, i * height + Math.random() * height, 30 + Math.random() * 80, 1);
        }
    }
    boardTexture = new THREE.CanvasTexture(canvas);
    boardTexture.colorSpace = THREE.SRGBColorSpace;
    boardTexture.wrapS = boardTexture.wrapT = THREE.RepeatWrapping;
    boardTexture.repeat.set(8, 3);
    boardTexture.anisotropy = 4;
    return boardTexture;
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
