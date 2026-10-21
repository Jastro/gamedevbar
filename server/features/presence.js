const { getIceServers } = require('../config');
const { cleanUsername, cleanModelId } = require('../validation');

// Who is connected, their name/model and position.
function registerPresence(hub) {
    hub.onConnect(({ ws, user }) => {
        // Enviar ID al nuevo usuario
        hub.send(ws, { type: 'init', userId: user.id, iceServers: getIceServers(user.id), serverTime: Date.now() });

        // Early announcement without the model (it isn't chosen yet); the full
        // one follows on initCompleted.
        const withoutModel = (someone) => {
            const { selectedModel, ...rest } = someone.toPublic();
            return rest;
        };
        hub.broadcast({ type: 'userJoined', ...withoutModel(user) }, ws);
        hub.users.forEach((existingUser, existingWs) => {
            if (existingWs !== ws) hub.send(ws, { type: 'userJoined', ...withoutModel(existingUser) });
        });
    });

    hub.on('setUsername', ({ user }, data) => {
        user.username = cleanUsername(data.username);
        user.selectedModel = cleanModelId(data.selectedModel);
        hub.broadcastAll({
            type: 'userUsername',
            userId: user.id,
            username: user.username,
            selectedModel: user.selectedModel
        });
    });

    hub.on('userMoved', ({ ws, user }, data) => {
        user.position = data.position;
        user.rotation = data.rotation;
        hub.broadcast({
            type: 'userMoved',
            userId: user.id,
            position: data.position,
            rotation: data.rotation
        }, ws);
    });

    // The client has loaded its avatar: announce it, send who is here, then let
    // the other features add their snapshot (door states, chat history...).
    hub.on('initCompleted', (ctx, data) => {
        const { ws, user } = ctx;
        user.username = cleanUsername(data.username);
        user.selectedModel = cleanModelId(data.selectedModel);

        hub.broadcast({ type: 'userJoined', ...user.toPublic() }, ws);
        hub.users.forEach((existingUser, existingWs) => {
            if (existingWs !== ws) hub.send(ws, { type: 'userJoined', ...existingUser.toPublic() });
        });

        hub.runJoinHooks(ctx);
    });

    // Registered first, so (leave hooks run in reverse) this runs last.
    hub.onLeave(({ ws, user }) => {
        hub.broadcast({ type: 'userLeft', userId: user.id }, ws);
    });
}

module.exports = { registerPresence };
