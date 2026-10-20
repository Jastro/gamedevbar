import { FloatingPanel } from './FloatingPanel';
import { RADIO_STATIONS } from '../audio/radioStations';

// Station picker, opened by clicking a room's radio. The station is shared by
// the whole room; "Silenciar para mí" only affects this player.
export class RadioUI {
    constructor(game) {
        this.game = game;
        this.panel = new FloatingPanel('radio-panel', '📻 Radio');
        this.roomId = null;

        this.list = document.createElement('div');
        this.list.className = 'radio-stations';
        RADIO_STATIONS.forEach(station => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'radio-station';
            button.dataset.station = station.id;
            const name = document.createElement('span');
            name.className = 'radio-station-name';
            name.textContent = station.name;
            const genre = document.createElement('span');
            genre.className = 'radio-station-genre';
            genre.textContent = station.genre;
            button.append(name, genre);
            button.addEventListener('click', () => this.pick(station.id));
            this.list.appendChild(button);
        });

        const actions = document.createElement('div');
        actions.className = 'floating-panel-actions';
        this.offButton = this.makeButton('Apagar', 'secondary', () => this.pick(null));
        this.muteButton = this.makeButton('', 'secondary', () => this.toggleMute());
        actions.append(this.offButton, this.muteButton);

        const note = document.createElement('div');
        note.className = 'floating-panel-note';
        note.textContent = 'La emisora la oye todo el bar.';

        this.panel.body.append(this.list, actions, note);
    }

    makeButton(label, variant, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `floating-panel-button ${variant}`;
        button.textContent = label;
        button.addEventListener('click', onClick);
        return button;
    }

    open(roomId) {
        this.roomId = roomId;
        const contents = this.game.environment.rooms.get(roomId);
        this.panel.setTitle(`📻 Radio · ${contents?.room.name ?? ''}`);
        this.refresh();
        this.panel.open();
    }

    get radio() {
        return this.game.environment.rooms.get(this.roomId)?.radio;
    }

    refresh() {
        const radio = this.radio;
        if (!radio) return;
        this.list.querySelectorAll('.radio-station').forEach(button => {
            button.classList.toggle('active', button.dataset.station === radio.stationId);
        });
        this.muteButton.textContent = radio.mutedLocally ? '🔇 Activar sonido para mí' : '🔈 Silenciar para mí';
    }

    pick(stationId) {
        this.game.radioSync.setStation(this.roomId, stationId);
        // The server echo updates the radio; reflect the choice right away.
        setTimeout(() => this.refresh(), 300);
    }

    toggleMute() {
        const radio = this.radio;
        radio?.setMutedLocally(!radio.mutedLocally);
        this.refresh();
    }
}
