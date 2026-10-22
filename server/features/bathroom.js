// Each bar's bathroom: door (with a latch), light, toilet (who's on it and
// what's in it), the stink after a number 2, and who has dirty hands.
// Clients only play the visuals; the shared state lives here.
const ROOM_ID_PATTERN = /^[a-z0-9_-]{1,32}$/;
const MAX_ROOMS = 32;
const STINK_MS = 10 * 60 * 1000;
const DIRTY_HANDS_MS = 10 * 60 * 1000;
// A toilet user who never sends toiletLeave (crash, closed tab mid-poo) is
// forgotten after this.
const OCCUPANT_TIMEOUT_MS = 2 * 60 * 1000;
// Per user and action, so mashing a button can't pile up sounds for everyone.
const COOLDOWN_MS = { door: 300, latch: 300, light: 300, toilet: 5000, flush: 2500, wash: 2000, spray: 2000 };

function freshState() {
    return { doorOpen: false, latchedBy: null, lightOn: true, mess: null, stinkUntil: 0, occupant: null, occupiedAt: 0 };
}

function registerBathroom(hub) {
    const rooms = new Map();
    const dirtyTimers = new Map(); // userId -> timeout clearing dirty hands

    const stateOf = (roomId) => {
        if (!rooms.has(roomId)) rooms.set(roomId, freshState());
        return rooms.get(roomId);
    };

    const validRoom = (roomId) => typeof roomId === 'string' && ROOM_ID_PATTERN.test(roomId)
        && (rooms.has(roomId) || rooms.size < MAX_ROOMS);

    const publicState = (state) => {
        const { occupiedAt, ...rest } = state;
        return rest;
    };

    const publish = (roomId) => {
        hub.broadcastAll({ type: 'bathroomState', roomId, state: publicState(stateOf(roomId)) });
    };

    const event = (roomId, kind, userId) => {
        hub.broadcastAll({ type: 'bathroomEvent', roomId, kind, userId });
    };

    const setDirty = (user, dirty) => {
        clearTimeout(dirtyTimers.get(user.id));
        dirtyTimers.delete(user.id);
        user.dirtyHands = dirty;
        if (dirty) dirtyTimers.set(user.id, setTimeout(() => setDirty(user, false), DIRTY_HANDS_MS));
        hub.broadcastAll({ type: 'hygiene', userId: user.id, dirty });
    };

    // false while that user's last use of `action` is too recent.
    const ready = (user, action) => {
        if (!user.bathroomCooldowns) user.bathroomCooldowns = {};
        const now = Date.now();
        if (now - (user.bathroomCooldowns[action] ?? 0) < COOLDOWN_MS[action]) return false;
        user.bathroomCooldowns[action] = now;
        return true;
    };

    const occupantGone = (state) => !state.occupant
        || !hub.findUser(state.occupant)
        || Date.now() - state.occupiedAt > OCCUPANT_TIMEOUT_MS;

    // `inside`: the sender is in the cubicle (client-side check). From
    // inside, anyone can open or unlatch, so nobody gets locked in.
    hub.on('bathroomDoor', ({ ws, user }, { roomId, inside }) => {
        if (!validRoom(roomId) || !ready(user, 'door')) return;
        const state = stateOf(roomId);
        if (!inside && state.latchedBy && state.latchedBy !== user.id && hub.findUser(state.latchedBy)) {
            hub.send(ws, { type: 'bathroomRefused', roomId, reason: 'latched' });
            return;
        }
        state.doorOpen = !state.doorOpen;
        // Opening it unlatches it.
        if (state.doorOpen) state.latchedBy = null;
        publish(roomId);
    });

    // From inside only (the latch knob is on the inner face).
    hub.on('bathroomLatch', ({ user }, { roomId, inside }) => {
        if (!validRoom(roomId) || !inside || !ready(user, 'latch')) return;
        const state = stateOf(roomId);
        if (state.latchedBy) {
            state.latchedBy = null;
        } else {
            state.latchedBy = user.id;
            state.doorOpen = false;
        }
        publish(roomId);
    });

    hub.on('bathroomLight', ({ user }, { roomId }) => {
        if (!validRoom(roomId) || !ready(user, 'light')) return;
        const state = stateOf(roomId);
        state.lightOn = !state.lightOn;
        publish(roomId);
    });

    hub.on('toiletUse', ({ ws, user }, { roomId, kind }) => {
        if (!validRoom(roomId) || (kind !== 'pee' && kind !== 'poo')) return;
        if (!ready(user, 'toilet')) return;
        const state = stateOf(roomId);
        if (state.occupant !== user.id && !occupantGone(state)) {
            hub.send(ws, { type: 'bathroomRefused', roomId, reason: 'occupied' });
            return;
        }
        state.occupant = user.id;
        state.occupiedAt = Date.now();
        // A poo outranks a pee in the bowl.
        if (kind === 'poo' || state.mess !== 'poo') state.mess = kind;
        if (kind === 'poo') state.stinkUntil = Date.now() + STINK_MS;
        event(roomId, kind, user.id);
        setDirty(user, true);
        publish(roomId);
    });

    hub.on('toiletLeave', ({ user }, { roomId }) => {
        if (!validRoom(roomId)) return;
        const state = stateOf(roomId);
        if (state.occupant !== user.id) return;
        state.occupant = null;
        publish(roomId);
    });

    hub.on('toiletFlush', ({ user }, { roomId }) => {
        if (!validRoom(roomId) || !ready(user, 'flush')) return;
        stateOf(roomId).mess = null;
        event(roomId, 'flush', user.id);
        publish(roomId);
    });

    hub.on('washHands', ({ user }, { roomId }) => {
        if (!validRoom(roomId) || !ready(user, 'wash')) return;
        event(roomId, 'wash', user.id);
        if (user.dirtyHands) setDirty(user, false);
    });

    hub.on('airFreshener', ({ user }, { roomId }) => {
        if (!validRoom(roomId) || !ready(user, 'spray')) return;
        stateOf(roomId).stinkUntil = 0;
        event(roomId, 'spray', user.id);
        publish(roomId);
    });

    hub.onJoin(({ ws }) => {
        const states = {};
        rooms.forEach((state, roomId) => { states[roomId] = publicState(state); });
        const dirty = [];
        hub.users.forEach(other => { if (other.dirtyHands) dirty.push(other.id); });
        hub.send(ws, { type: 'bathroomStates', rooms: states, dirty });
    });

    hub.onLeave(({ user }) => {
        clearTimeout(dirtyTimers.get(user.id));
        dirtyTimers.delete(user.id);
        rooms.forEach((state, roomId) => {
            let changed = false;
            if (state.latchedBy === user.id) {
                state.latchedBy = null;
                changed = true;
            }
            if (state.occupant === user.id) {
                state.occupant = null;
                changed = true;
            }
            if (changed) publish(roomId);
        });
    });
}

module.exports = { registerBathroom };
