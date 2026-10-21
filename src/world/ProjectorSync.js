// Server-authoritative projector per room: play/pause/resume/stop go to the
// server, which broadcasts `projectorState` (snapshot `projectorStates` on
// join) with the server time, so every client derives the same position.
export class ProjectorSync {
    constructor(game) {
        this.game = game;
    }

    bind() {
        const { network, environment } = this.game;

        environment.rooms.forEach(({ room, projector }) => {
            projector.onError = (reason) => this.game.ui.chat?.addMessage({
                type: 'system',
                message: `📽️ Proyector de ${room.name}: ${reason}.`
            });
        });

        network.on('projectorStates', (data) => {
            this.game.serverClock.sync(data.serverTime);
            Object.entries(data.screens || {}).forEach(([roomId, state]) => {
                environment.rooms.get(roomId)?.projector.applyState(state);
            });
        });
        network.on('projectorState', (data) => {
            this.game.serverClock.sync(data.serverTime);
            const contents = environment.rooms.get(data.roomId);
            if (!contents) return;
            const previous = contents.projector.state;
            contents.projector.applyState(data.state);
            this.announce(contents.room.name, previous, data.state, data.by ?? 'Alguien');
            this.game.ui.projector?.refresh();
        });
    }

    announce(roomName, previous, state, by) {
        let action;
        if (!state) action = 'ha apagado el proyector';
        else if (!previous || previous.videoId !== state.videoId) action = 'ha puesto un vídeo en el proyector';
        else if (state.pausedAt !== null) action = 'ha pausado el proyector';
        else action = 'ha reanudado el proyector';
        this.game.ui.chat?.addMessage({ type: 'system', message: `📽️ ${by} ${action} de ${roomName}` });
    }

    send(type, roomId, extra = {}) {
        if (this.game.network.isConnected) {
            this.game.network.send(type, { roomId, ...extra });
            return;
        }
        // Offline (no server): apply locally with the same rules as the server.
        const projector = this.game.environment.rooms.get(roomId)?.projector;
        if (!projector) return;
        const now = this.game.serverClock.now();
        const state = projector.state;
        if (type === 'projectorPlay') projector.applyState({ videoId: extra.videoId, startedAt: now, pausedAt: null });
        if (type === 'projectorPause' && state && state.pausedAt === null) {
            projector.applyState({ ...state, pausedAt: (now - state.startedAt) / 1000 });
        }
        if (type === 'projectorResume' && state && state.pausedAt !== null) {
            projector.applyState({ ...state, startedAt: now - state.pausedAt * 1000, pausedAt: null });
        }
        if (type === 'projectorStop') projector.applyState(null);
    }

    play(roomId, videoId) { this.send('projectorPlay', roomId, { videoId }); }
    pause(roomId) { this.send('projectorPause', roomId); }
    resume(roomId) { this.send('projectorResume', roomId); }
    stop(roomId) { this.send('projectorStop', roomId); }
}
