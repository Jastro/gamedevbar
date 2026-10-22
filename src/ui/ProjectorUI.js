import { FloatingPanel } from './FloatingPanel';
import { parseYouTubeId } from '../media/youtube';

// Projector controls, opened by clicking a room's screen: paste a YouTube
// link, pause/resume, turn off. Everyone in the bar sees the same video.
export class ProjectorUI {
    constructor(game) {
        this.game = game;
        this.panel = new FloatingPanel('projector-panel', '📽️ Proyector');
        this.roomId = null;

        this.form = document.createElement('form');
        this.form.className = 'projector-form';
        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.placeholder = 'Enlace de YouTube';
        this.input.setAttribute('aria-label', 'Enlace de YouTube');
        const submit = document.createElement('button');
        submit.type = 'submit';
        submit.className = 'floating-panel-button';
        submit.textContent = 'Poner';
        this.form.append(this.input, submit);
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.play();
        });

        this.status = document.createElement('div');
        this.status.className = 'floating-panel-note';

        const actions = document.createElement('div');
        actions.className = 'floating-panel-actions';
        this.pauseButton = this.makeButton('', 'secondary', () => this.togglePause());
        this.stopButton = this.makeButton('Apagar', 'secondary', () => this.game.projectorSync.stop(this.roomId));
        actions.append(this.pauseButton, this.stopButton);

        const note = document.createElement('div');
        note.className = 'floating-panel-note';
        note.textContent = 'Todo el bar ve lo mismo. Algunos vídeos no se pueden ver fuera de YouTube.';

        // Karaoke: find a lyrics video, paste its link here, sing on the stage.
        const karaoke = document.createElement('div');
        karaoke.className = 'floating-panel-note';
        const link = document.createElement('a');
        link.href = 'https://www.youtube.com/results?search_query=karaoke+con+letra';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = '🎤 Buscar karaoke en YouTube ↗';
        link.style.color = '#ffb37a';
        karaoke.append(link, ' — pega el enlace aquí y sube al escenario.');

        this.panel.body.append(this.form, this.status, actions, karaoke, note);
    }

    makeButton(label, variant, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `floating-panel-button ${variant}`;
        button.textContent = label;
        button.addEventListener('click', onClick);
        return button;
    }

    get projector() {
        return this.game.environment.rooms.get(this.roomId)?.projector;
    }

    open(roomId) {
        this.roomId = roomId;
        const contents = this.game.environment.rooms.get(roomId);
        this.panel.setTitle(`📽️ Proyector · ${contents?.room.name ?? ''}`);
        this.input.value = '';
        this.refresh();
        this.panel.open();
        setTimeout(() => this.input.focus(), 50);
    }

    refresh() {
        if (!this.panel.isOpen && !this.roomId) return;
        const state = this.projector?.state;
        const active = Boolean(state);
        this.pauseButton.disabled = !active;
        this.stopButton.disabled = !active;
        this.pauseButton.textContent = state?.pausedAt !== null && active ? '▶ Reanudar' : '⏸ Pausar';
        this.status.textContent = !active
            ? 'Apagado.'
            : `${state.pausedAt !== null ? 'En pausa' : 'Reproduciendo'}: youtu.be/${state.videoId}`;
    }

    play() {
        const videoId = parseYouTubeId(this.input.value);
        if (!videoId) {
            this.status.textContent = 'Ese enlace no parece de YouTube.';
            return;
        }
        this.game.projectorSync.play(this.roomId, videoId);
        this.input.value = '';
        this.input.blur();
    }

    togglePause() {
        const state = this.projector?.state;
        if (!state) return;
        if (state.pausedAt === null) this.game.projectorSync.pause(this.roomId);
        else this.game.projectorSync.resume(this.roomId);
    }
}
