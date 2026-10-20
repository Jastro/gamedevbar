// "/furbo" starts a soccer match for everyone; the ball is client-simulated and relayed.
function registerSoccer(hub) {
    hub.command('/furbo', ({ user }) => {
        hub.broadcastAll({ type: 'startSoccerGame', initiatorId: user.id, active: true });
    });

    hub.on('soccerBallUpdate', ({ ws }, data) => {
        hub.broadcast({ type: 'soccerBallUpdate', position: data.position, velocity: data.velocity }, ws);
    });
}

module.exports = { registerSoccer };
