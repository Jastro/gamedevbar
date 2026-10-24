import * as items from './items';

// Everything a player can wear, in one place: adding an accessory is one
// entry here (plus its builder in items.js). Ids travel over the network and
// are saved in the browser, so never rename one; retire it instead.

export const SLOTS = {
    head: { name: 'Cabeza' },
    face: { name: 'Cara' },
    hand: { name: 'Mano' }
};

export const ITEMS = [
    // Head
    { id: 'cap', slot: 'head', name: 'Gorra', icon: '🧢', build: () => items.cap() },
    { id: 'police-cap', slot: 'head', name: 'Gorra de poli', icon: '👮', build: items.policeCap },
    { id: 'top-hat', slot: 'head', name: 'Chistera', icon: '🎩', build: items.topHat },
    { id: 'viking', slot: 'head', name: 'Casco vikingo', icon: '⚔️', build: items.vikingHelmet },
    { id: 'crown', slot: 'head', name: 'Corona', icon: '👑', build: items.crown },
    { id: 'beret', slot: 'head', name: 'Boina', icon: '🎨', build: items.beret },
    { id: 'headset', slot: 'head', name: 'Cascos gamer', icon: '🎧', build: items.headset },
    { id: 'mushroom', slot: 'head', name: 'Seta', icon: '🍄', build: items.mushroomHat },
    { id: 'question-block', slot: 'head', name: 'Bloque ?', icon: '❓', build: items.questionBlock },
    { id: 'halo', slot: 'head', name: 'Aureola', icon: '😇', build: items.halo },
    { id: 'devil-horns', slot: 'head', name: 'Cuernos', icon: '😈', build: items.devilHorns },
    { id: 'beer-helmet', slot: 'head', name: 'Casco cervecero', icon: '🍺', build: items.beerHelmet },
    { id: 'pirate-hat', slot: 'head', name: 'Sombrero pirata', icon: '🏴‍☠️', build: items.pirateHat },
    { id: 'chef-hat', slot: 'head', name: 'Gorro de cocina', icon: '👨‍🍳', build: items.chefHat },
    // Face
    { id: 'sunglasses', slot: 'face', name: 'Gafas de sol', icon: '🕶️', build: items.sunglasses },
    { id: 'pixel-shades', slot: 'face', name: 'Gafas pixeladas', icon: '😎', build: items.pixelShades },
    { id: 'monocle', slot: 'face', name: 'Monóculo', icon: '🧐', build: items.monocle },
    { id: 'mustache', slot: 'face', name: 'Bigote', icon: '🥸', build: items.mustache },
    { id: 'vr', slot: 'face', name: 'Gafas VR', icon: '🥽', build: items.vrHeadset },
    { id: 'eye-patch', slot: 'face', name: 'Parche', icon: '🏴', build: items.eyePatch },
    // Right hand
    { id: 'beer', slot: 'hand', name: 'Jarra de cerveza', icon: '🍺', build: items.beerMug },
    { id: 'wine', slot: 'hand', name: 'Copa de vino', icon: '🍷', build: items.wineGlass },
    { id: 'bottle', slot: 'hand', name: 'Botellín', icon: '🍾', build: items.bottle },
    { id: 'tortilla', slot: 'hand', name: 'Pincho de tortilla', icon: '🥚', build: items.tortillaPincho },
    { id: 'gamepad', slot: 'hand', name: 'Mando', icon: '🎮', build: items.gamepad },
    { id: 'sword', slot: 'hand', name: 'Espada pixel', icon: '🗡️', build: items.pixelSword },
    { id: 'baton', slot: 'hand', name: 'Porra', icon: '🚓', build: items.baton },
    { id: 'microphone', slot: 'hand', name: 'Micrófono', icon: '🎤', build: items.microphone },
    { id: 'one-up', slot: 'hand', name: 'Seta 1UP', icon: '🍄', build: items.oneUpMushroom },
    // Also what the bar serves (src/bar/drinks.js).
    { id: 'shot', slot: 'hand', name: 'Chupito', icon: '🥃', build: items.shotGlass },
    { id: 'cubata', slot: 'hand', name: 'Cubata', icon: '🍹', build: items.cubata },
    { id: 'coffee', slot: 'hand', name: 'Café', icon: '☕', build: items.coffeeCup },
    { id: 'soda', slot: 'hand', name: 'Refresco', icon: '🥤', build: items.sodaCan }
];

const ITEMS_BY_ID = new Map(ITEMS.map(item => [item.id, item]));

export function getItem(id) {
    return ITEMS_BY_ID.get(id) ?? null;
}

// Tints multiply the character's texture (null = its own colors).
export const TINTS = [null, '#ff8a80', '#ffd180', '#fff59d', '#b9f6ca', '#80d8ff', '#b388ff', '#f8bbd0', '#bcaaa4', '#9e9e9e'];
export const NAME_COLORS = [null, '#ff7043', '#ffd54f', '#81c784', '#4fc3f7', '#ba68c8', '#f06292', '#e0e0e0'];
export const SCALE_RANGE = { min: 0.85, max: 1.15 };

export const DEFAULT_APPEARANCE = { head: null, face: null, hand: null, tint: null, scale: 1, nameColor: null };

// Whatever arrives (saved, or from the network) becomes a valid appearance:
// unknown ids and colors are dropped.
export function normalizeAppearance(value) {
    const result = { ...DEFAULT_APPEARANCE };
    if (!value || typeof value !== 'object') return result;
    Object.keys(SLOTS).forEach(slot => {
        const item = getItem(value[slot]);
        if (item?.slot === slot) result[slot] = item.id;
    });
    if (TINTS.includes(value.tint)) result.tint = value.tint;
    if (NAME_COLORS.includes(value.nameColor)) result.nameColor = value.nameColor;
    const scale = Number(value.scale);
    if (Number.isFinite(scale)) result.scale = Math.min(SCALE_RANGE.max, Math.max(SCALE_RANGE.min, scale));
    return result;
}
