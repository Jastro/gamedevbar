import * as THREE from 'three';
import SHARED from '../../server/shared/stickers.json';

// The stickers (StickerSync places them, the 👤 menu picks one). Drawn in
// code, no image files: in the spirit of each meme rather than copies of
// the originals. Each is a 256² canvas with a transparent background and a
// white sticker border; the ids are shared with the server.
const SIZE = 256;
const FONT = 'Impact, Anton, "Arial Black", sans-serif';

const DESIGNS = {
    pito: { name: 'Pito feliz', draw: drawPito },
    ggez: { name: 'GG EZ', draw: badge({ shape: 'circle', colors: ['#6a1b9a', '#e040fb'], emoji: '🏆', lines: ['GG EZ'], color: '#ffeb3b' }) },
    leeroy: { name: 'Leeroy', draw: badge({ colors: ['#e65100', '#ffb300'], emoji: '🐔', lines: ['LEEROY', 'JENKINS!'], color: '#ffffff' }) },
    cake: { name: 'Cake is a lie', draw: badge({ shape: 'circle', colors: ['#4e342e', '#f06292'], emoji: '🎂', lines: ['THE CAKE', 'IS A LIE'], color: '#ffffff' }) },
    pressf: { name: 'Press F', draw: drawKeycap },
    wasted: { name: 'Wasted', draw: drawWasted },
    gitgud: { name: 'Git gud', draw: badge({ shape: 'circle', colors: ['#212121', '#616161'], emoji: '💀', lines: ['GIT GUD'], color: '#ffffff' }) },
    skill: { name: 'Skill issue', draw: badge({ colors: ['#00695c', '#26c6da'], emoji: '🤡', lines: ['SKILL', 'ISSUE'], color: '#fff59d' }) },
    fine: { name: 'This is fine', draw: badge({ colors: ['#bf360c', '#ffca28'], emoji: '🐶☕', lines: ['THIS IS', 'FINE 🔥'], color: '#ffffff' }) },
    doge: { name: 'Doge', draw: drawDoge },
    nerf: { name: 'Nerf this', draw: badge({ shape: 'circle', colors: ['#ad1457', '#ff80ab'], emoji: '🐰', lines: ['NERF', 'THIS!'], color: '#ffffff' }) },
    gamedev: { name: '/gamedev/', draw: badge({ colors: ['#101820', '#37474f'], emoji: '🎮', lines: ['MV', '/gamedev/'], color: '#ff9800' }) }
};

export const STICKERS = SHARED.ids.map(id => ({ id, name: DESIGNS[id]?.name ?? id }));
export const DEFAULT_STICKER = SHARED.ids[0];

const canvases = new Map();
const textures = new Map();

export function stickerCanvas(id) {
    if (!canvases.has(id)) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        (DESIGNS[id]?.draw ?? DESIGNS[DEFAULT_STICKER].draw)(ctx);
        canvases.set(id, canvas);
    }
    return canvases.get(id);
}

export function stickerTexture(id) {
    if (!textures.has(id)) {
        const texture = new THREE.CanvasTexture(stickerCanvas(id));
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        textures.set(id, texture);
    }
    return textures.get(id);
}

// --- Drawing helpers --------------------------------------------------------

function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// The sticker's body: a white border, then the gradient inside.
function body(ctx, shape, [from, to]) {
    const path = () => {
        if (shape === 'circle') {
            ctx.beginPath();
            ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 10, 0, Math.PI * 2);
        } else {
            roundedRect(ctx, 10, 34, SIZE - 20, SIZE - 68, 34);
        }
    };
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 8;
    path();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(SIZE / 2, SIZE / 2);
    ctx.scale(0.93, 0.93);
    ctx.translate(-SIZE / 2, -SIZE / 2);
    path();
    const gradient = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    gradient.addColorStop(0, from);
    gradient.addColorStop(1, to);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
}

// Outlined meme text, shrunk to fit `maxWidth`.
function memeText(ctx, text, x, y, size, maxWidth, color) {
    let fontSize = size;
    ctx.font = `${fontSize}px ${FONT}`;
    while (ctx.measureText(text).width > maxWidth && fontSize > 12) {
        fontSize -= 2;
        ctx.font = `${fontSize}px ${FONT}`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, fontSize / 7);
    ctx.strokeStyle = '#000000';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}

function emoji(ctx, text, x, y, size) {
    ctx.font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
}

// An emoji over one or two lines of meme text, on a round or rounded badge.
function badge({ shape = 'rounded', colors, emoji: icon, lines, color }) {
    return (ctx) => {
        body(ctx, shape, colors);
        const textTop = lines.length > 1 ? 150 : 172;
        if (icon) emoji(ctx, icon, SIZE / 2, lines.length > 1 ? 88 : 98, icon.length > 2 ? 58 : 70);
        lines.forEach((line, i) => memeText(ctx, line, SIZE / 2, textTop + i * 42, 44, SIZE - 64, color));
    };
}

function drawPito(ctx) {
    const skin = '#f6b3a3';
    const tip = '#ef8f86';
    const ink = '#5d2e2e';
    const shapes = [
        (c) => { c.beginPath(); c.arc(96, 196, 42, 0, Math.PI * 2); },
        (c) => { c.beginPath(); c.arc(160, 196, 42, 0, Math.PI * 2); },
        (c) => roundedRect(c, 92, 66, 72, 140, 36),
        (c) => { c.beginPath(); c.ellipse(128, 70, 46, 38, 0, 0, Math.PI * 2); }
    ];
    // The white sticker border around the whole silhouette.
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 22;
    ctx.lineJoin = 'round';
    shapes.forEach(shape => { shape(ctx); ctx.stroke(); ctx.fill(); });
    ctx.restore();
    // Balls and shaft, then the tip on top.
    ctx.lineWidth = 5;
    ctx.strokeStyle = ink;
    shapes.forEach((shape, i) => {
        shape(ctx);
        ctx.fillStyle = i === 3 ? tip : skin;
        ctx.fill();
        ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(128, 46);
    ctx.lineTo(128, 60);
    ctx.stroke();
    // A happy face: googly eyes, blush and a grin.
    [[112, 128], [146, 124]].forEach(([x, y], i) => {
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + (i ? 3 : -2), y + 3, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1a1a';
        ctx.fill();
    });
    ctx.fillStyle = 'rgba(233, 30, 99, 0.35)';
    [[102, 150], [156, 148]].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.beginPath();
    ctx.arc(129, 146, 15, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.lineWidth = 4;
    ctx.stroke();
    emoji(ctx, '✨', 206, 50, 34);
}

function drawKeycap(ctx) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 8;
    roundedRect(ctx, 22, 22, SIZE - 44, SIZE - 44, 36);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
    roundedRect(ctx, 34, 34, SIZE - 68, SIZE - 68, 28);
    ctx.fillStyle = '#90a4ae';
    ctx.fill();
    roundedRect(ctx, 50, 42, SIZE - 100, SIZE - 104, 22);
    const top = ctx.createLinearGradient(0, 42, 0, SIZE - 62);
    top.addColorStop(0, '#eceff1');
    top.addColorStop(1, '#cfd8dc');
    ctx.fillStyle = top;
    ctx.fill();
    ctx.font = `110px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#263238';
    ctx.fillText('F', SIZE / 2, 112);
    memeText(ctx, 'PRESS F', SIZE / 2, 190, 34, SIZE - 110, '#ffffff');
}

function drawWasted(ctx) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 8;
    roundedRect(ctx, 8, 72, SIZE - 16, 112, 18);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
    roundedRect(ctx, 16, 80, SIZE - 32, 96, 12);
    ctx.fillStyle = 'rgba(15, 15, 15, 0.9)';
    ctx.fill();
    ctx.save();
    ctx.translate(SIZE / 2, 128);
    ctx.scale(1, 1.15);
    memeText(ctx, 'WASTED', 0, 0, 76, SIZE - 56, '#c62828');
    ctx.restore();
}

function drawDoge(ctx) {
    body(ctx, 'circle', ['#fff3c4', '#e0b25a']);
    emoji(ctx, '🐕', SIZE / 2, 138, 104);
    const words = [
        ['wow', 74, 74, '#d81b60', -0.2],
        ['such bar', 172, 78, '#1e88e5', 0.15],
        ['very gamedev', 128, 204, '#43a047', 0],
        ['much beer', 84, 170, '#8e24aa', -0.1]
    ];
    words.forEach(([text, x, y, color, angle]) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.font = 'bold 22px "Comic Sans MS", "Comic Neue", cursive';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.fillText(text, 0, 0);
        ctx.restore();
    });
}
