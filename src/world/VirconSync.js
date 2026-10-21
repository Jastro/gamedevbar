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
        network.on('virconStates', (data) => {
            Object.entries(data.cabinets || {}).forEach(([roomId, state]) => this.cabinet(roomId)?.setOccupant(state));
        });
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
