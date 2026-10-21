import * as THREE from 'three';

// Accessory builders, made of Three.js primitives (no assets to license).
// Units are avatar space: a head is about 0.92 wide and 0.8 tall. Each
// builder returns a group whose origin sits on its anchor:
// - head items: origin on top of the skull, +y up, +z forward;
// - face items: origin on the face at eye height, the front is +z;
// - hand items: origin in the palm of the right hand, +y up.

const materials = new Map();
function mat(color, options = {}) {
    const key = `${color}:${JSON.stringify(options)}`;
    if (!materials.has(key)) {
        materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...options }));
    }
    return materials.get(key);
}

function mesh(geometry, material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    return m;
}

function group(...children) {
    const g = new THREE.Group();
    children.forEach(child => g.add(child));
    return g;
}

// A canvas texture with one glyph, for blocks and labels.
function glyphTexture(text, background, color, size = 128) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = color;
    ctx.font = `bold ${size * 0.7}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2 + size * 0.04);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    return texture;
}

// --- Head ----------------------------------------------------------------

export function cap(color = 0xdc5a0b) {
    const crown = mesh(new THREE.SphereGeometry(0.42, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(color), 0, -0.06, 0);
    crown.scale.set(1.05, 0.7, 1.05);
    const visor = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 20, 1, false, -Math.PI / 2, Math.PI), mat(color), 0, -0.05, 0.36);
    visor.scale.set(1.2, 1, 0.9);
    const button = mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(0xffffff), 0, 0.24, 0);
    return group(crown, visor, button);
}

export function topHat() {
    const brim = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 24), mat(0x111111));
    const tube = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.55, 24), mat(0x161616), 0, 0.29, 0);
    const band = mesh(new THREE.CylinderGeometry(0.325, 0.325, 0.09, 24), mat(0x8b1a1a), 0, 0.08, 0);
    return group(brim, tube, band);
}

export function vikingHelmet() {
    const dome = mesh(new THREE.SphereGeometry(0.47, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x8a8f96, { metalness: 0.6, roughness: 0.4 }), 0, -0.12, 0);
    const rim = mesh(new THREE.TorusGeometry(0.47, 0.04, 8, 24), mat(0x6b4a1f), 0, -0.1, 0);
    rim.rotation.x = Math.PI / 2;
    const horns = [-1, 1].map(side => {
        const horn = mesh(new THREE.ConeGeometry(0.08, 0.42, 10), mat(0xf1e6c8), side * 0.48, 0.12, 0);
        horn.rotation.z = -side * 0.9;
        return horn;
    });
    return group(dome, rim, ...horns);
}

export function crown() {
    const gold = mat(0xf2c12e, { metalness: 0.8, roughness: 0.3 });
    const ring = mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.18, 24, 1, true), gold, 0, 0.08, 0);
    ring.material = gold.clone();
    ring.material.side = THREE.DoubleSide;
    const spikes = Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        return mesh(new THREE.ConeGeometry(0.07, 0.18, 6), gold, Math.sin(angle) * 0.34, 0.26, Math.cos(angle) * 0.34);
    });
    const gem = mesh(new THREE.OctahedronGeometry(0.06), mat(0xd0103a, { metalness: 0.3, roughness: 0.2 }), 0, 0.1, 0.36);
    return group(ring, ...spikes, gem);
}

export function beret() {
    const top = mesh(new THREE.SphereGeometry(0.46, 20, 10), mat(0x7a1020), 0.06, 0.02, -0.04);
    top.scale.set(1, 0.32, 1);
    const stalk = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.07, 6), mat(0x7a1020), 0.06, 0.17, -0.04);
    return group(top, stalk);
}

export function headset() {
    const black = mat(0x1b1b1f);
    const band = mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 24, Math.PI), black, 0, -0.32, 0);
    band.rotation.y = Math.PI / 2;
    const cups = [-1, 1].map(side => {
        const cup = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16), mat(0x2ec27e, { emissive: 0x0a4d2c }), side * 0.5, -0.38, 0);
        cup.rotation.z = Math.PI / 2;
        return cup;
    });
    const boom = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.38, 6), black, 0.42, -0.5, 0.2);
    boom.rotation.x = Math.PI / 2.4;
    const mic = mesh(new THREE.SphereGeometry(0.04, 8, 6), black, 0.42, -0.58, 0.38);
    return group(band, ...cups, boom, mic);
}

export function mushroomHat() {
    const capMesh = mesh(new THREE.SphereGeometry(0.55, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd9262b), 0, -0.1, 0);
    capMesh.scale.set(1, 0.75, 1);
    const spots = [[0, 0.3, 0.2], [0.32, 0.12, 0.2], [-0.32, 0.12, 0.2], [0.2, 0.2, -0.3], [-0.22, 0.22, -0.28]]
        .map(([x, y, z]) => mesh(new THREE.SphereGeometry(0.09, 10, 8), mat(0xffffff), x, y, z));
    return group(capMesh, ...spots);
}

export function questionBlock() {
    const face = new THREE.MeshStandardMaterial({ map: glyphTexture('?', '#f5a623', '#ffffff'), roughness: 0.5 });
    const block = mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), face, 0, 0.22, 0);
    return group(block);
}

export function halo() {
    const ring = mesh(new THREE.TorusGeometry(0.3, 0.035, 8, 32), mat(0xffe27a, { emissive: 0xffd23f, emissiveIntensity: 0.8 }), 0, 0.22, 0);
    ring.rotation.x = Math.PI / 2;
    return group(ring);
}

export function devilHorns() {
    return group(...[-1, 1].map(side => {
        const horn = mesh(new THREE.ConeGeometry(0.09, 0.36, 10), mat(0xb3121c), side * 0.27, 0.12, 0.1);
        horn.rotation.z = -side * 0.35;
        return horn;
    }));
}

export function beerHelmet() {
    const band = mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.1, 24, 1, true), mat(0xf0f0f0, { side: THREE.DoubleSide }), 0, -0.14, 0);
    const cans = [-1, 1].map(side => {
        const can = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.26, 14), mat(0xc8102e, { metalness: 0.7, roughness: 0.3 }), side * 0.55, -0.05, 0);
        return can;
    });
    const straws = [-1, 1].map(side => {
        const straw = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 6), mat(0xffffff), side * 0.33, -0.25, 0.2);
        straw.rotation.z = side * 1.1;
        straw.rotation.x = -0.4;
        return straw;
    });
    return group(band, ...cans, ...straws);
}

export function pirateHat() {
    const black = mat(0x141414);
    const base = mesh(new THREE.CylinderGeometry(0.56, 0.64, 0.3, 3), black, 0, 0.1, 0);
    base.rotation.y = Math.PI;
    const skull = mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(0xffffff), 0, 0.12, 0.34);
    return group(base, skull);
}

export function chefHat() {
    const white = mat(0xffffff);
    const band = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.16, 20), white, 0, 0.06, 0);
    const puff = mesh(new THREE.SphereGeometry(0.4, 16, 12), white, 0, 0.32, 0);
    puff.scale.set(1, 0.7, 1);
    return group(band, puff);
}

// --- Face ----------------------------------------------------------------

export function sunglasses() {
    const black = mat(0x0d0d0d, { roughness: 0.2, metalness: 0.4 });
    const lenses = [-1, 1].map(side => mesh(new THREE.BoxGeometry(0.28, 0.14, 0.03), black, side * 0.2, 0, 0));
    const bridge = mesh(new THREE.BoxGeometry(0.12, 0.03, 0.03), black, 0, 0.04, 0);
    return group(...lenses, bridge);
}

export function pixelShades() {
    // "Deal with it": stepped black pixels with a white glint.
    const black = mat(0x050505);
    const pixels = [];
    const rows = [[-6, 6], [-6, -1], [1, 6], [-5, -2], [2, 5]];
    rows.forEach(([from, to], row) => {
        for (let x = from; x <= to; x++) pixels.push(mesh(new THREE.BoxGeometry(0.06, 0.06, 0.03), black, x * 0.06, -row * 0.06 + 0.06, 0));
    });
    pixels.push(mesh(new THREE.BoxGeometry(0.06, 0.06, 0.035), mat(0xffffff), -0.24, 0, 0.005));
    pixels.push(mesh(new THREE.BoxGeometry(0.06, 0.06, 0.035), mat(0xffffff), 0.18, 0, 0.005));
    return group(...pixels);
}

export function monocle() {
    const gold = mat(0xd4af37, { metalness: 0.9, roughness: 0.25 });
    const ring = mesh(new THREE.TorusGeometry(0.1, 0.015, 8, 24), gold, 0.2, 0, 0.01);
    const glass = mesh(new THREE.CircleGeometry(0.1, 24), new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.35 }), 0.2, 0, 0.005);
    const chain = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.4, 4), gold, 0.28, -0.25, 0.01);
    chain.rotation.z = 0.3;
    return group(ring, glass, chain);
}

export function mustache() {
    const brown = mat(0x3b2412);
    return group(...[-1, 1].map(side => {
        const half = mesh(new THREE.SphereGeometry(0.1, 12, 8), brown, side * 0.1, -0.2, 0.06);
        half.scale.set(1.3, 0.45, 0.5);
        half.rotation.z = side * 0.25;
        return half;
    }));
}

export function vrHeadset() {
    const body = mesh(new THREE.BoxGeometry(0.62, 0.26, 0.2), mat(0xeeeeee), 0, 0, 0.06);
    const front = mesh(new THREE.BoxGeometry(0.56, 0.2, 0.02), mat(0x111122, { roughness: 0.15, metalness: 0.5 }), 0, 0, 0.17);
    const strap = mesh(new THREE.BoxGeometry(0.96, 0.08, 0.7), mat(0x333333), 0, 0.02, -0.3);
    strap.material = strap.material.clone();
    strap.material.transparent = true;
    strap.material.opacity = 0.95;
    return group(body, front, strap);
}

export function eyePatch() {
    const black = mat(0x0a0a0a);
    const patch = mesh(new THREE.CircleGeometry(0.11, 18), black, -0.2, 0.01, 0.01);
    const strap = mesh(new THREE.BoxGeometry(0.95, 0.025, 0.02), black, 0, 0.06, 0);
    strap.rotation.z = -0.25;
    return group(patch, strap);
}

// --- Right hand ----------------------------------------------------------

export function beerMug() {
    const glass = new THREE.MeshStandardMaterial({ color: 0xffb400, transparent: true, opacity: 0.85, roughness: 0.15 });
    const beer = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.24, 16), glass, 0, 0.12, 0.08);
    const foam = mesh(new THREE.CylinderGeometry(0.105, 0.1, 0.06, 16), mat(0xfffaf0), 0, 0.26, 0.08);
    const handle = mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 16, Math.PI), mat(0xdddddd, { transparent: true, opacity: 0.7 }), -0.1, 0.12, 0.08);
    handle.rotation.z = Math.PI / 2;
    return group(beer, foam, handle);
}

export function wineGlass() {
    const glassMaterial = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.35, roughness: 0.1 });
    const bowl = mesh(new THREE.SphereGeometry(0.08, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), glassMaterial, 0, 0.24, 0.06);
    bowl.rotation.x = Math.PI;
    const wine = mesh(new THREE.SphereGeometry(0.07, 14, 8, 0, Math.PI * 2, Math.PI * 0.6, Math.PI * 0.4), mat(0x6d0f1f), 0, 0.235, 0.06);
    wine.rotation.x = Math.PI;
    const stem = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.14, 6), glassMaterial, 0, 0.1, 0.06);
    const foot = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 14), glassMaterial, 0, 0.03, 0.06);
    return group(bowl, wine, stem, foot);
}

export function bottle() {
    const green = new THREE.MeshStandardMaterial({ color: 0x1f6b2a, transparent: true, opacity: 0.9, roughness: 0.2 });
    const body = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.24, 14), green, 0, 0.12, 0.06);
    const neck = mesh(new THREE.CylinderGeometry(0.025, 0.06, 0.12, 12), green, 0, 0.3, 0.06);
    const label = mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.08, 14, 1, true), mat(0xf3e2b3), 0, 0.12, 0.06);
    return group(body, neck, label);
}

export function gamepad() {
    const body = mesh(new THREE.BoxGeometry(0.3, 0.06, 0.15), mat(0x2b2b33), 0, 0.04, 0.1);
    const grips = [-1, 1].map(side => {
        const grip = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 12), mat(0x2b2b33), side * 0.14, 0.04, 0.04);
        return grip;
    });
    const buttons = [[0.08, 0.13], [0.11, 0.1], [0.05, 0.1], [0.08, 0.07]].map(([x, z], i) =>
        mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 8), mat([0xe53935, 0x43a047, 0x1e88e5, 0xfdd835][i]), x, 0.08, z));
    const dpad = mesh(new THREE.BoxGeometry(0.06, 0.02, 0.02), mat(0x111111), -0.08, 0.08, 0.1);
    const dpad2 = mesh(new THREE.BoxGeometry(0.02, 0.02, 0.06), mat(0x111111), -0.08, 0.08, 0.1);
    return group(body, ...grips, ...buttons, dpad, dpad2);
}

export function pixelSword() {
    const blade = mesh(new THREE.BoxGeometry(0.05, 0.5, 0.02), mat(0xcfd8dc, { metalness: 0.7, roughness: 0.3 }), 0, 0.38, 0.05);
    const guard = mesh(new THREE.BoxGeometry(0.2, 0.04, 0.04), mat(0x8d6e63), 0, 0.12, 0.05);
    const hilt = mesh(new THREE.BoxGeometry(0.04, 0.12, 0.04), mat(0x5d4037), 0, 0.04, 0.05);
    return group(blade, guard, hilt);
}

export function microphone() {
    const handle = mesh(new THREE.CylinderGeometry(0.025, 0.018, 0.2, 10), mat(0x222222), 0, 0.1, 0.06);
    const head = mesh(new THREE.SphereGeometry(0.05, 12, 10), mat(0x9e9e9e, { metalness: 0.6, roughness: 0.4 }), 0, 0.23, 0.06);
    return group(handle, head);
}

export function tortillaPincho() {
    // A slice of Spanish omelette on a cocktail stick.
    const slice = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.09, 16, 1, false, 0, Math.PI / 3), mat(0xf2c14e), 0, 0.12, 0.04);
    slice.rotation.y = Math.PI * 0.85;
    const crust = mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.03, 16, 1, false, 0, Math.PI / 3), mat(0xc98b2b), 0, 0.17, 0.04);
    crust.rotation.y = Math.PI * 0.85;
    const stick = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 4), mat(0xe0c08a), 0, 0.16, 0.04);
    return group(slice, crust, stick);
}

export function oneUpMushroom() {
    const capMesh = mesh(new THREE.SphereGeometry(0.1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x2fa84f), 0, 0.12, 0.06);
    const spots = [[0, 0.2, 0.06], [0.07, 0.15, 0.1], [-0.07, 0.15, 0.1]].map(([x, y, z]) =>
        mesh(new THREE.SphereGeometry(0.025, 8, 6), mat(0xffffff), x, y, z));
    const stem = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12), mat(0xfff4dc), 0, 0.08, 0.06);
    return group(capMesh, ...spots, stem);
}
