// Server-authoritative occupancy of each room's Vircon32 cabinet:
// `virconStart` asks for it, the server answers with `virconState` to
// everyone (or `virconBusy` to the asker); `virconStop` frees it. Join
// snapshot: `virconStates`. The emulator itself only runs on the player's
// client (VirconUI starts it once the server confirms).
export class VirconSync {
    constructor(game) {
        this.game = game;
        this.pending = null; // { roomId, rom } waiting for the server
    }

    cabinet(roomId) {
        return this.game.environment.rooms.get(roomId)?.vircon;
    }

    get localId() {
        return this.game.players.localPlayer?.id;
    }

    bind() {
        const { network } = this.game;
        // The join snapshot lists only busy cabinets; after a reconnect, the
        // others must be cleared (they may have been freed meanwhile).
        network.on('virconStates', (data) => {
            const cabinets = data.cabinets || {};
            this.game.environment.rooms.forEach(({ vircon }, roomId) => vircon.setOccupant(cabinets[roomId] ?? null));
        });
        // The server frees the cabinet with the lost connection (and a
        // reconnect respawns the avatar), so the game ends here too.
        network.on('disconnect', () => this.game.ui.vircon.endPlay());
        network.on('virconState', (data) => {
            const cabinet = this.cabinet(data.roomId);
            if (!cabinet) return;
            cabinet.setOccupant(data.state);
            const room = this.game.environment.rooms.get(data.roomId).room;
            if (data.state && data.state.playerId !== this.localId) {
                this.game.ui.chat?.addMessage({
                    type: 'system',
                    message: `🎮 ${data.state.playerName} juega a ${data.state.romTitle} en ${room.name}`
                });
            }
            const pending = this.pending;
            if (pending && pending.roomId === data.roomId && data.state?.playerId === this.localId) {
                this.pending = null;
                this.game.ui.vircon.beginPlay(data.roomId, pending.rom);
            }
        });
        network.on('virconBusy', (data) => {
            if (this.pending?.roomId === data.roomId) this.pending = null;
            this.cabinet(data.roomId)?.setOccupant(data.state);
            this.game.ui.chat?.addMessage({
                type: 'system',
                message: `🎮 ${data.state?.playerName ?? 'Alguien'} ya está jugando en esa máquina.`
            });
        });
    }

    // rom: { title, url, isBlob? }. Uploaded carts (blob URLs) aren't streamed.
    request(roomId, rom) {
        const watchable = !rom.isBlob;
        if (!this.game.network.isConnected) {
            this.cabinet(roomId)?.setOccupant({ playerId: this.localId, playerName: this.game.username, romTitle: rom.title, watchable });
            this.game.ui.vircon.beginPlay(roomId, rom);
            return;
        }
        this.pending = { roomId, rom };
        this.game.network.send('virconStart', { roomId, romTitle: rom.title, watchable });
    }

    release(roomId) {
        if (this.game.network.isConnected) {
            this.game.network.send('virconStop', { roomId });
        } else {
            this.cabinet(roomId)?.setOccupant(null);
        }
    }
}
