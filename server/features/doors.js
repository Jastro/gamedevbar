const { LIMITS } = require('../config');

// Door states (doorId -> isOpen). Door ids come from the client layout
// ("<roomId>:front"), so they are validated and the map is capped.
const DOOR_ID_PATTERN = /^[a-z0-9_-]{1,32}:[a-z0-9_-]{1,32}$/;

function registerDoors(hub) {
    const doors = new Map();

    hub.on('doorToggle', (ctx, data) => {
        const doorId = data.doorId;
        if (typeof doorId !== 'string' || !DOOR_ID_PATTERN.test(doorId)) return;
        if (!doors.has(doorId) && doors.size >= LIMITS.doors) return;

        const isOpen = !doors.get(doorId);
        doors.set(doorId, isOpen);
        hub.broadcastAll({ type: 'doorState', doorId, isOpen });
    });

    // Current door states, so the newcomer sees open doors as open
    hub.onJoin(({ ws }) => {
        hub.send(ws, { type: 'doorStates', doors: Object.fromEntries(doors) });
    });
}

module.exports = { registerDoors };
