// Seat occupancy. Seat ids are client-local Three.js ids (known issue, see Docs/Systems.md).
function registerSeats(hub) {
    const seats = new Map(); // seatId -> userId

    hub.on('userSat', ({ ws, user }, data) => {
        if (seats.has(data.seatId)) {
            hub.send(ws, { type: 'error', message: 'Seat already occupied' });
            return;
        }
        // Liberar asiento anterior si existe
        if (user.seatId) seats.delete(user.seatId);

        user.seatId = data.seatId;
        seats.set(data.seatId, user.id);
        hub.broadcast({ type: 'userSat', userId: user.id, seatId: data.seatId }, ws);
    });

    hub.on('userStood', ({ ws, user }) => {
        if (!user.seatId) return;
        seats.delete(user.seatId);
        user.seatId = null;
        hub.broadcast({ type: 'userStood', userId: user.id }, ws);
    });

    // Liberar asiento si el usuario estaba sentado
    hub.onLeave(({ user }) => {
        if (user.seatId) seats.delete(user.seatId);
    });
}

module.exports = { registerSeats };
