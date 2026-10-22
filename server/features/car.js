// The Uber Suicida (the black car on the plaza): five seats shared by
// everyone; seat 0 drives it (driving.js, car 'uber'). With two or
// more people inside, a 5 s countdown starts (cancelled if they drop below
// two); then everyone inside gets `carSmoke` (smoke, fade out, each lands
// somewhere random, all on their clients). Seats are cleared at that moment;
// `riding` keeps the car closed until the ride is over.
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
        const occupants = passengers();
        slots.fill(null);
        hub.broadcastAll({ type: 'carSmoke', occupants });
        publish();
        setTimeout(() => {
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

    // `slot` is optional: without it (the usual case) the server picks the
    // first free seat, so two people getting in at once both fit.
    hub.on('carSit', ({ ws, user }, data) => {
        if (slots.includes(user.id)) return;
        const slot = data.slot ?? slots.indexOf(null);
        if (!Number.isInteger(slot) || slot < -1 || slot >= SLOTS) return;
        const reason = riding ? 'riding' : slot === -1 ? 'full' : slots[slot] ? 'taken' : null;
        if (reason) {
            hub.send(ws, { type: 'carDenied', reason });
            return;
        }
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
