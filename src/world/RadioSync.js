import { getStation } from '../audio/radioStations';

// Server-authoritative station per room: `radioSet` goes to the server, which
// broadcasts `radioState` to everyone (snapshot `radioStates` on join).
// Rooms nobody has touched play their RoomLayout default.
export class RadioSync {
    constructor(game) {
        this.game = game;
    }

    // After Environment.create(): start every room on its default station.
    applyDefaults() {
        this.game.environment.rooms.forEach(({ room, radio }) => {
            radio.setStation(room.definition.radioStation ?? null);
        });
    }

    bind() {
        const { network, environment } = this.game;
        network.on('radioStates', (data) => {
            Object.entries(data.stations || {}).forEach(([roomId, stationId]) => {
                environment.rooms.get(roomId)?.radio.setStation(stationId);
            });
        });
        network.on('radioState', (data) => {
            const contents = environment.rooms.get(data.roomId);
            if (!contents) return;
            contents.radio.setStation(data.stationId);
            if (this.game.ui.radio?.panel.isOpen) this.game.ui.radio.refresh();
            const station = getStation(data.stationId);
            this.game.ui.chat?.addMessage({
                type: 'system',
                message: station
                    ? `📻 ${data.by ?? 'Alguien'} ha puesto ${station.name} en ${contents.room.name}`
                    : `📻 ${data.by ?? 'Alguien'} ha apagado la radio de ${contents.room.name}`
            });
        });
    }

    setStation(roomId, stationId) {
        if (this.game.network.isConnected) {
            this.game.network.send('radioSet', { roomId, stationId });
        } else {
            this.game.environment.rooms.get(roomId)?.radio.setStation(stationId);
        }
    }
}
