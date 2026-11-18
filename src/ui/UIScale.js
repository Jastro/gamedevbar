// HUD scale: the chat, buttons and panels keep their designed size in windows
// of at least REF_WIDTH x REF_HEIGHT and shrink with smaller windows (never
// grow past it). Sets --ui-scale on <html>; index.html applies it with `zoom`
// on each HUD root. Phones keep their own layout (the max-width: 480px rules).
const REF_WIDTH = 1920;
const REF_HEIGHT = 900;
const MIN_SCALE = 0.55;
const PHONE_WIDTH = 480;

let scale = 1;

// Elements under a zoomed root use CSS pixels times this; divide viewport
// coordinates (clientX/Y) by it before putting them in style.left/top.
export function getUIScale() {
    return scale;
}

function update() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    scale = width <= PHONE_WIDTH
        ? 1
        : Math.max(MIN_SCALE, Math.min(1, width / REF_WIDTH, height / REF_HEIGHT));
    scale = Math.round(scale * 1000) / 1000;
    document.documentElement.style.setProperty('--ui-scale', String(scale));
}

export function initUIScale() {
    update();
    window.addEventListener('resize', update);
}
