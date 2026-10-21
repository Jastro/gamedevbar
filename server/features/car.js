// The black car on the street: five seats shared by everyone. With two or
// more people inside, a 5 s countdown starts (cancelled if they drop below
// two); then everyone inside gets `carSmoke` (smoke, fade out, each lands
// somewhere random, all on their clients) and the seats are cleared.
const SLOTS = 5;
const COUNTDOWN_MS = 5000;
const RIDE_MS = 6000; // smoke + fade + teleport on the clients
const MIN_PASSENGERS = 2;

function registerCar(hub) {
    const slots = new Array(SLOTS).fill(null); // playerId per seat
    let countdownEndsAt = null;
    let countdownTimer = null;
    let riding = false;

    const publish = () => {
        hub.broadcastAll({ type: 'carState', slots, countdownEndsAt, riding });
    };

    const passengers = () => slots.filter(Boolean);

    const updateCountdown = () => {
        const enough = passengers().length >= MIN_PASSENGERS;
        if (enough && !countdownTimer && !riding) {
            countdownEndsAt = Date.now() + COUNTDOWN_MS;
            countdownTimer = setTimeout(ride, COUNTDOWN_MS);
        } else if (!enough && countdownTimer) {
            clearTimeout(countdownTimer);
            countdownTimer = null;
            countdownEndsAt = null;
        }
    };

    const ride = () => {
        countdownTimer = null;
        countdownEndsAt = null;
        riding = true;
        hub.broadcastAll({ type: 'carSmoke', occupants: passengers() });
        publish();
        setTimeout(() => {
            slots.fill(null);
            riding = false;
            publish();
        }, RIDE_MS);
    };

    const freeSeatOf = (userId) => {
        const index = slots.indexOf(userId);
        if (index === -1) return false;
        slots[index] = null;
        return true;
    };

    hub.on('carSit', ({ ws, user }, data) => {
        const slot = data.slot;
        if (!Number.isInteger(slot) || slot < 0 || slot >= SLOTS) return;
        if (riding || (slots[slot] && slots[slot] !== user.id)) {
            hub.send(ws, { type: 'carDenied', slot });
            return;
        }
        freeSeatOf(user.id);
        slots[slot] = user.id;
        updateCountdown();
        publish();
    });

    hub.on('carLeave', ({ user }) => {
        if (riding || !freeSeatOf(user.id)) return;
        updateCountdown();
        publish();
    });

    hub.onJoin(({ ws }) => {
        hub.send(ws, { type: 'carState', slots, countdownEndsAt, riding });
    });

    hub.onLeave(({ user }) => {
        if (!freeSeatOf(user.id)) return;
        updateCountdown();
        publish();
    });
}

module.exports = { registerCar };
