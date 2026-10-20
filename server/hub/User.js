const { v4: uuidv4 } = require('uuid');

// Per-connection player state. Features may add their own fields.
class User {
    constructor(ws) {
        this.id = uuidv4();
        this.ws = ws;
        this.username = null;
        this.position = [0, 1, 0]; // same [x, y, z] shape clients send in userMoved
        this.rotation = 0;
        this.selectedModel = 'pj'; // Modelo por defecto
    }

    // What other clients get in userJoined.
    toPublic() {
        return {
            userId: this.id,
            username: this.username,
            position: this.position,
            rotation: this.rotation,
            selectedModel: this.selectedModel,
            seatId: this.seatId ?? null
        };
    }
}

module.exports = { User };
