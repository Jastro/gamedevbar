import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { ROOM_HALF_WIDTH, ROOM_HALF_DEPTH, WALL_THICKNESS } from './RoomLayout';

// Fake windows on a building's outside walls (room-local, for a bar or a
// closed building): a painted window (frame, panes, a hint of curtain), two
// green shutters and a stone sill, in two rows, house style. They're only a
// face: nothing behind them. All of one building's windows are merged into
// three meshes. front: x positions on the front wall (around its door/sign).
const LOWER = { y: 3.1, width: 1.3, height: 1.7 };
const UPPER = { y: 6.2, width: 1.1, height: 1.3 };
const SIDE_Z = [-5.5, 0, 5.5];
const BACK_X = [-10, -3.5, 3.5, 10];
const OFF_WALL = 0.03;

export function addWindows(parent, { lowerFront = [], upperFront = [] } = {}) {
    const panes = [];
    const shutters = [];
    const sills = [];
    // A wall face: its outward normal and where along it, in room-local terms.
    const place = (geometry, x, y, z, rotationY) => {
        geometry.rotateY(rotationY);
        geometry.translate(x, y, z);
        return geometry;
    };
    const add = (size, x, z, rotationY) => {
        const { width, height, y } = size;
        panes.push(place(new THREE.PlaneGeometry(width, height), x, y, z, rotationY));
        // Shutters either side (in the window's own frame, then turned).
        [-1, 1].forEach(side => {
            const shutter = new THREE.PlaneGeometry(width * 0.5, height * 1.04);
            shutter.translate(side * (width * 0.75 + 0.04), 0, 0.005);
            shutters.push(place(shutter, x, y, z, rotationY));
        });
        const sill = new THREE.BoxGeometry(width + 0.3, 0.1, 0.18);
        sill.translate(0, -height / 2 - 0.05, 0.07);
        sills.push(place(sill, x, y, z, rotationY));
    };
    const outX = ROOM_HALF_WIDTH + WALL_THICKNESS / 2 + OFF_WALL;
    const outZ = ROOM_HALF_DEPTH + WALL_THICKNESS / 2 + OFF_WALL;
    [LOWER, UPPER].forEach(size => {
        SIDE_Z.forEach(z => {
            add(size, outX, z, Math.PI / 2);   // right wall, facing +x
            add(size, -outX, z, -Math.PI / 2); // left wall, facing -x
        });
        BACK_X.forEach(x => add(size, x, -outZ, Math.PI)); // back wall, facing -z
    });
    lowerFront.forEach(x => add(LOWER, x, outZ, 0));
    upperFront.forEach(x => add(UPPER, x, outZ, 0));

    const materials = getMaterials();
    [[panes, materials.window], [shutters, materials.shutter], [sills, materials.sill]].forEach(([geometries, material]) => {
        const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
        mesh.name = 'Windows';
        mesh.raycast = () => {};
        parent.add(mesh);
    });
}

let materials = null;
function getMaterials() {
    if (materials) return materials;
    materials = {
        window: new THREE.MeshStandardMaterial({ map: drawWindow(), roughness: 0.4 }),
        shutter: new THREE.MeshStandardMaterial({ map: drawShutter(), roughness: 0.8 }),
        sill: new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.9 })
    };
    return materials;
}

function canvasTexture(width, height, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
}

// White frame, four panes of dark glass with a sky reflection, a warm hint
// of curtain at the sides.
function drawWindow() {
    return canvasTexture(128, 160, (ctx, w, h) => {
        ctx.fillStyle = '#f2efe8';
        ctx.fillRect(0, 0, w, h);
        const border = 10;
        const bar = 6;
        const paneW = (w - border * 2 - bar) / 2;
        const paneH = (h - border * 2 - bar) / 2;
        for (let row = 0; row < 2; row++) {
            for (let column = 0; column < 2; column++) {
                const x = border + column * (paneW + bar);
                const y = border + row * (paneH + bar);
                const glass = ctx.createLinearGradient(x, y, x + paneW, y + paneH);
                glass.addColorStop(0, '#5c7a99');
                glass.addColorStop(0.45, '#2a3b4d');
                glass.addColorStop(1, '#1b2531');
                ctx.fillStyle = glass;
                ctx.fillRect(x, y, paneW, paneH);
                ctx.fillStyle = 'rgba(255,255,255,0.18)';
                ctx.beginPath();
                ctx.moveTo(x, y + paneH * 0.6);
                ctx.lineTo(x + paneW * 0.6, y);
                ctx.lineTo(x + paneW * 0.8, y);
                ctx.lineTo(x, y + paneH * 0.8);
                ctx.fill();
            }
        }
        ctx.fillStyle = 'rgba(178, 74, 58, 0.55)';
        ctx.fillRect(border, border, 12, h - border * 2);
        ctx.fillRect(w - border - 12, border, 12, h - border * 2);
    });
}

// Green louvred shutter: a frame and slats.
function drawShutter() {
    return canvasTexture(64, 160, (ctx, w, h) => {
        ctx.fillStyle = '#2f6b46';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#245437';
        for (let y = 10; y < h - 10; y += 9) ctx.fillRect(7, y, w - 14, 4);
        ctx.strokeStyle = '#1c4029';
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, w - 6, h - 6);
    });
}
