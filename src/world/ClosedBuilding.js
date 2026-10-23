import * as THREE from 'three';
import {
    slotPlacement, ROOM_HALF_WIDTH, ROOM_HALF_DEPTH, WALL_HEIGHT, WALL_THICKNESS, FRONT_DOOR
} from './RoomLayout';
import { createRoof } from './Roof';
import { addWindows } from './Windows';

// A building in a slot with no bar yet: the same shell, walls and roof as a
// bar, but solid all round (nothing inside), a door that doesn't open and a
// big "PRÓXIMA APERTURA" sign over it. Walls block people and cars and keep
// the camera out. For when the next bar opens, it becomes a Room.
const SIGN = { width: 13, height: 3.2, y: 5.6 };

export function createClosedBuilding(scene, slot, { collisionManager, cameraOccluders, wallMaterial }) {
    const { origin, rotationY } = slotPlacement(slot);
    const group = new THREE.Group();
    group.name = `ClosedBuilding_${slot}`;
    group.position.set(origin.x, 0, origin.z);
    group.rotation.y = rotationY;
    scene.add(group);
    // Colliders come from world matrices: resolve the placement first.
    group.updateMatrixWorld(true);

    const addWall = (width, depth, x, z) => {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(width, WALL_HEIGHT, depth), wallMaterial);
        wall.position.set(x, WALL_HEIGHT / 2, z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        group.add(wall);
        wall.updateMatrixWorld(true);
        collisionManager.addCollider(wall);
        cameraOccluders.push(wall);
    };
    addWall(ROOM_HALF_WIDTH * 2, WALL_THICKNESS, 0, -ROOM_HALF_DEPTH);
    addWall(ROOM_HALF_WIDTH * 2, WALL_THICKNESS, 0, ROOM_HALF_DEPTH);
    addWall(WALL_THICKNESS, ROOM_HALF_DEPTH * 2, -ROOM_HALF_WIDTH, 0);
    addWall(WALL_THICKNESS, ROOM_HALF_DEPTH * 2, ROOM_HALF_WIDTH, 0);

    addDoor(group);
    addSign(group);
    // On the front only clear of the sign.
    addWindows(group, { lowerFront: [-10, 10], upperFront: [-10, 10] });
    createRoof(group, wallMaterial);
}

// A shut door on the front wall's outer face, where a bar's entrance is.
function addDoor(group) {
    const face = ROOM_HALF_DEPTH + WALL_THICKNESS / 2;
    const wood = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.75 });
    const frame = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.8 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.8, roughness: 0.3 });
    const box = (w, h, d, material, x, y, z) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        mesh.position.set(x, y, z);
        group.add(mesh);
        return mesh;
    };
    const { x, width, height } = FRONT_DOOR;
    box(width + 0.3, 0.15, 0.08, frame, x, height + 0.075, face + 0.04);
    [-1, 1].forEach(side => box(0.15, height, 0.08, frame, x + side * (width / 2 + 0.075), height / 2, face + 0.04));
    box(width, height, 0.06, wood, x, height / 2, face + 0.03);
    // Two raised panels and a knob.
    [height * 0.28, height * 0.7].forEach(y => box(width * 0.7, height * 0.32, 0.04, frame, x, y, face + 0.07));
    box(0.1, 0.1, 0.08, brass, x + width / 2 - 0.25, height * 0.5, face + 0.1);
}

function addSign(group) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = Math.round(1024 * SIGN.height / SIGN.width);
    const ctx = canvas.getContext('2d');
    const { width: w, height: h } = canvas;
    // Yellow board with hazard stripes along the top and bottom.
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(0, 0, w, h);
    const band = h * 0.14;
    [0, h - band].forEach(y => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, y, w, band);
        ctx.clip();
        ctx.fillStyle = '#1a1a1a';
        for (let x = -band * 2; x < w + band; x += band * 1.6) {
            ctx.beginPath();
            ctx.moveTo(x, y + band);
            ctx.lineTo(x + band * 0.8, y + band);
            ctx.lineTo(x + band * 1.6, y);
            ctx.lineTo(x + band * 0.8, y);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    });
    ctx.fillStyle = '#1a1a1a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = h * 0.42;
    ctx.font = `${size}px Impact, Anton, "Arial Black", sans-serif`;
    while (ctx.measureText('PRÓXIMA APERTURA').width > w * 0.9) {
        size -= 4;
        ctx.font = `${size}px Impact, Anton, "Arial Black", sans-serif`;
    }
    ctx.fillText('PRÓXIMA APERTURA', w / 2, h / 2 + size * 0.04);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#1a1a1a';
    ctx.strokeRect(5, 5, w - 10, h - 10);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    // A little glow of its own, so it reads at night too.
    const material = new THREE.MeshStandardMaterial({
        map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.6
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(SIGN.width, SIGN.height), material);
    sign.position.set(0, SIGN.y, ROOM_HALF_DEPTH + WALL_THICKNESS / 2 + 0.03);
    sign.name = 'ProximaApertura';
    group.add(sign);
}
