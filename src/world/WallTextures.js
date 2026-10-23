import * as THREE from 'three';

// The bars' wall finishes, drawn in code (no image files). Each style is a
// canvas texture tiling `width` meters across and `height` meters up from
// the floor; World maps every wall face's UVs in meters, so the pattern
// keeps its size on walls of any length and lines up from wall to wall.
//   timber:    half-timbered plaster (outside), a 4 × 4 m frame that repeats.
//   whitewash: whitewashed wall with an ochre base (outside), wall height.
//   wainscot:  wooden wainscot and cream plaster (inside), wall height.
//   plaster:   the wainscot's cream plaster alone (the roof's inner gables).
const STYLES = {
    timber: { width: 4, height: 4, size: [512, 512], draw: drawTimber },
    whitewash: { width: 4, height: 8, size: [512, 1024], draw: drawWhitewash },
    wainscot: { width: 2, height: 8, size: [256, 1024], draw: drawWainscot },
    plaster: { width: 2, height: 2, size: [256, 256], draw: (ctx, w, h, random) => plaster(ctx, w, h, random, '#efe2c4') }
};

const cache = new Map();

// { texture, width, height } for a style, or null.
export function wallFinish(style) {
    const definition = STYLES[style];
    if (!definition) return null;
    if (!cache.has(style)) {
        const canvas = document.createElement('canvas');
        [canvas.width, canvas.height] = definition.size;
        const random = seeded(style.length * 7919);
        definition.draw(canvas.getContext('2d'), canvas.width, canvas.height, random);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = 8;
        cache.set(style, { texture, width: definition.width, height: definition.height });
    }
    return cache.get(style);
}

// The same pattern on every load (no flicker between visits).
function seeded(seed) {
    let state = seed % 2147483647 || 1;
    return () => {
        state = (state * 16807) % 2147483647;
        return state / 2147483647;
    };
}

function speckle(ctx, w, h, random, amount, count) {
    for (let i = 0; i < count; i++) {
        ctx.fillStyle = `rgba(${random() < 0.5 ? '0,0,0' : '255,255,255'},${amount * random()})`;
        ctx.fillRect(random() * w, random() * h, 2, 2);
    }
}

// Soft blotches over a flat color: hand-applied plaster.
function plaster(ctx, w, h, random, color) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < (w * h) / 900; i++) {
        ctx.fillStyle = `rgba(0,0,0,${0.025 * random()})`;
        ctx.beginPath();
        ctx.arc(random() * w, random() * h, 8 + random() * 30, 0, Math.PI * 2);
        ctx.fill();
    }
    speckle(ctx, w, h, random, 0.06, (w * h) / 40);
}

function drawTimber(ctx, w, h, random) {
    plaster(ctx, w, h, random, '#ece3cf');
    const beam = w * 0.06;
    ctx.fillStyle = '#4a2f1d';
    // Top and bottom beams (shared with the tiles above and below), and posts.
    ctx.fillRect(0, 0, w, beam / 2);
    ctx.fillRect(0, h - beam / 2, w, beam / 2);
    ctx.fillRect(0, 0, beam / 2, h);
    ctx.fillRect(w - beam / 2, 0, beam / 2, h);
    ctx.fillRect(w / 2 - beam / 2, 0, beam, h);
    // Braces from the corners down to the middle post.
    ctx.strokeStyle = '#4a2f1d';
    ctx.lineWidth = beam;
    ctx.beginPath();
    ctx.moveTo(beam / 2, beam / 2);
    ctx.lineTo(w / 2 - beam / 2, h - beam / 2);
    ctx.moveTo(w - beam / 2, beam / 2);
    ctx.lineTo(w / 2 + beam / 2, h - beam / 2);
    ctx.stroke();
    // Grain on the wood.
    for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `rgba(0,0,0,${0.15 * random()})`;
        ctx.fillRect(random() * w, random() * h, 6 + random() * 18, 1);
    }
}

function drawWhitewash(ctx, w, h, random) {
    plaster(ctx, w, h, random, '#f3efe6');
    // The ochre base, 0.9 m of the 8 m, with a darker line on top.
    const base = h * (0.9 / 8);
    ctx.fillStyle = '#c9a15a';
    ctx.fillRect(0, h - base, w, base);
    ctx.fillStyle = '#a47f3e';
    ctx.fillRect(0, h - base - 4, w, 4);
    speckle(ctx, w, base, random, 0.08, 3000);
}

function drawWainscot(ctx, w, h, random) {
    plaster(ctx, w, h, random, '#efe2c4');
    // Wood up to 1.2 m: vertical boards, then a rail.
    const panel = h * (1.2 / 8);
    const top = h - panel;
    const board = w / 8;
    for (let x = 0; x < w; x += board) {
        const shade = 0.85 + random() * 0.25;
        ctx.fillStyle = `rgb(${Math.round(122 * shade)}, ${Math.round(74 * shade)}, ${Math.round(40 * shade)})`;
        ctx.fillRect(x, top, board - 2, panel);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x + board - 2, top, 2, panel);
        for (let g = 0; g < 5; g++) {
            ctx.strokeStyle = `rgba(0,0,0,${0.1 * random()})`;
            ctx.beginPath();
            const gx = x + random() * board;
            ctx.moveTo(gx, top);
            ctx.lineTo(gx + random() * 4 - 2, h);
            ctx.stroke();
        }
    }
    ctx.fillStyle = '#5a341b';
    ctx.fillRect(0, top - 10, w, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, top - 10, w, 2);
}
