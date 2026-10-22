// What the bar serves. `item` is the hand accessory shown while holding it
// (src/appearance/catalog.js); `alcohol` is added to the drunk level over
// the drink's sips (negative sobers you up). Keep the ids and alcohol in
// sync with server/features/drinks.js, which owns the levels.
export const DRINKS = [
    { id: 'beer', name: 'Caña', icon: '🍺', item: 'beer', alcohol: 1 },
    { id: 'wine', name: 'Vino', icon: '🍷', item: 'wine', alcohol: 1 },
    { id: 'shot', name: 'Chupito', icon: '🥃', item: 'shot', alcohol: 1.5 },
    { id: 'cubata', name: 'Cubata', icon: '🍹', item: 'cubata', alcohol: 2 },
    { id: 'coffee', name: 'Café', icon: '☕', item: 'coffee', alcohol: -1.5 },
    { id: 'soda', name: 'Refresco', icon: '🥤', item: 'soda', alcohol: 0 }
];

export const SIPS_PER_DRINK = 3;
export const MAX_DRUNK = 6;
// The drunk level drops one point every this long.
export const DRUNK_DECAY_MS = 2 * 60 * 1000;

export function getDrink(id) {
    return DRINKS.find(drink => drink.id === id) ?? null;
}

// Level now, from the last known level and when it was set (server time).
export function drunkLevelAt(level, at, now) {
    return Math.max(0, level - Math.max(0, now - at) / DRUNK_DECAY_MS);
}
