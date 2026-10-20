const { WebSocketServer } = require('ws');
const { User } = require('./User');

// WebSocket plumbing shared by all features: connection lifecycle, message
// routing by `type`, chat commands and send helpers. Features register in
// server/index.js; see Docs/Architecture.md ("Adding a server feature").
class Hub {
    constructor(httpServer) {
        this.wss = new WebSocketServer({ server: httpServer });
        this.users = new Map(); // ws -> User
        this.handlers = new Map(); // type -> handler(ctx, data)
        this.commands = new Map(); // '/cmd' -> handler(ctx, args)
        this.hooks = { connect: [], join: [], leave: [] };
        this.wss.on('connection', (ws) => this.handleConnection(ws));
    }

    // --- Registration --------------------------------------------------------

    // One handler per message type. `data` is untrusted: check fields before use.
    on(type, handler) {
        if (this.handlers.has(type)) throw new Error(`Duplicate handler for '${type}'`);
        this.handlers.set(type, handler);
    }

    // Chat commands (e.g. '/furbo'); the chat feature asks runCommand first.
    command(name, handler) {
        this.commands.set(name.toLowerCase(), handler);
    }

    // connect: socket opened. join: player finished loading (initCompleted).
    // leave: socket closed; leave hooks run in reverse order, like teardown.
    onConnect(hook) { this.hooks.connect.push(hook); }
    onJoin(hook) { this.hooks.join.push(hook); }
    onLeave(hook) { this.hooks.leave.push(hook); }

    runJoinHooks(ctx) {
        this.hooks.join.forEach(hook => hook(ctx));
    }

    runCommand(ctx, text) {
        const [name, ...args] = text.trim().split(/\s+/);
        const handler = this.commands.get(name.toLowerCase());
        if (!handler) return false;
        handler(ctx, args);
        return true;
    }

    // --- Sending -------------------------------------------------------------

    send(ws, message) {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
    }

    // Everyone except `exceptWs` (pass null to include everyone).
    broadcast(message, exceptWs = null) {
        const json = JSON.stringify(message);
        this.wss.clients.forEach(client => {
            if (client !== exceptWs && client.readyState === client.OPEN) client.send(json);
        });
    }

    broadcastAll(message) {
        this.broadcast(message, null);
    }

    // Users can disconnect between a message being sent and handled, so this may miss.
    findUser(userId) {
        for (const [ws, user] of this.users) {
            if (user.id === userId) return { ws, user };
        }
        return null;
    }

    // --- Lifecycle -----------------------------------------------------------

    handleConnection(ws) {
        const user = new User(ws);
        this.users.set(ws, user);
        const ctx = { ws, user, hub: this };
        this.hooks.connect.forEach(hook => hook(ctx));

        ws.on('message', (message) => this.handleMessage(ctx, message));
        ws.on('close', () => this.handleClose(ctx));
        ws.on('error', (error) => console.error('WebSocket error:', error));
    }

    handleMessage(ctx, message) {
        let data;
        try {
            data = JSON.parse(message);
        } catch (error) {
            console.warn(`Ignoring malformed WS frame from ${ctx.user.id}`);
            return;
        }
        if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;

        const handler = this.handlers.get(data.type);
        if (!handler) return;
        // A throwing handler must not take the whole process down.
        try {
            handler(ctx, data);
        } catch (error) {
            console.error(`Error handling '${data.type}' from ${ctx.user.id}:`, error);
        }
    }

    handleClose(ctx) {
        if (!this.users.has(ctx.ws)) return;
        [...this.hooks.leave].reverse().forEach(hook => {
            try {
                hook(ctx);
            } catch (error) {
                console.error('Error in leave hook:', error);
            }
        });
        this.users.delete(ctx.ws);
    }
}

module.exports = { Hub };
