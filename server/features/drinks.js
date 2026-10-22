// The bar: what each player is holding (drink + sips left) and how drunk
// they are. Levels decay with time; clients do the same math from
// `{ drunk, at }` (src/bar/drinks.js), so there's no timer here.
const DRINKS = { beer: 1, wine: 1, shot: 1.5, cubata: 2, coffee: -1.5, soda: 0 }; // id -> alcohol
const SIPS_PER_DRINK = 3;
const MAX_DRUNK = 6;
const DRUNK_DECAY_MS = 2 * 60 * 1000;
const ORDER_COOLDOWN_MS = 2000;
const SIP_COOLDOWN_MS = 800;

function registerDrinks(hub) {
    const levelNow = (user, now = Date.now()) => {
        const drunk = user.drunk ?? { level: 0, at: now };
        return Math.max(0, drunk.level - Math.max(0, now - drunk.at) / DRUNK_DECAY_MS);
    };

    const stateOf = (user) => ({
        userId: user.id,
        drink: user.drink?.id ?? null,
        sips: user.drink?.sips ?? 0,
        drunk: user.drunk?.level ?? 0,
        at: user.drunk?.at ?? Date.now()
    });

    const publish = (user) => hub.broadcastAll({ type: 'drinkState', ...stateOf(user) });

    hub.on('drinkOrder', ({ user }, { drink }) => {
        if (!(drink in DRINKS)) return;
        const now = Date.now();
        if (now - (user.lastDrinkOrder ?? 0) < ORDER_COOLDOWN_MS) return;
        user.lastDrinkOrder = now;
        user.drink = { id: drink, sips: SIPS_PER_DRINK };
        publish(user);
    });

    hub.on('drinkSip', ({ user }) => {
        if (!user.drink) return;
        const now = Date.now();
        if (now - (user.lastSip ?? 0) < SIP_COOLDOWN_MS) return;
        user.lastSip = now;
        const level = levelNow(user, now) + DRINKS[user.drink.id] / SIPS_PER_DRINK;
        user.drunk = { level: Math.min(MAX_DRUNK, Math.max(0, level)), at: now };
        user.drink.sips -= 1;
        if (user.drink.sips <= 0) user.drink = null;
        hub.broadcastAll({ type: 'drinkSipped', userId: user.id });
        publish(user);
    });

    hub.onJoin(({ ws }) => {
        const states = [];
        hub.users.forEach(other => {
            if (other.drink || levelNow(other) > 0) states.push(stateOf(other));
        });
        hub.send(ws, { type: 'drinkStates', states });
    });
}

module.exports = { registerDrinks };
