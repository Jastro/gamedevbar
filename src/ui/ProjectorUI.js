import { FloatingPanel } from './FloatingPanel';
import { parseYouTubeId } from '../media/youtube';
import { parseTwitchLink } from '../media/twitch';

// Projector controls, opened by clicking a room's screen: paste a YouTube or
// Twitch link (live channel or past broadcast), pause/resume, turn off.
// Everyone in the bar sees the same thing.

// A pasted link → { provider, videoId }, { error } or null.
export function parseProjectorLink(text) {
    const youTubeId = parseYouTubeId(text);
    if (youTubeId) return { provider: 'youtube', videoId: youTubeId };
    return parseTwitchLink(text);
}

// Short label for the panel's status line.
export function describeMedia(state) {
    if (state.provider === 'twitch') return `twitch.tv/${state.videoId} (directo)`;
    if (state.provider === 'twitch-vod') return `twitch.tv/videos/${state.videoId}`;
    return `youtu.be/${state.videoId}`;
}
export class ProjectorUI {
    constructor(game) {
        this.game = game;
        this.panel = new FloatingPanel('projector-panel', '📽️ Proyector');
        this.roomId = null;

        this.form = document.createElement('form');
        this.form.className = 'projector-form';
        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.placeholder = 'Enlace de YouTube o Twitch';
        this.input.setAttribute('aria-label', 'Enlace de YouTube o Twitch');
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
        note.textContent = 'Todo el bar ve lo mismo. De Twitch valen canales en directo y vídeos (no clips). '
            + 'Algunos vídeos de YouTube no se pueden ver fuera de YouTube.';

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
            : `${state.pausedAt !== null ? 'En pausa' : 'Reproduciendo'}: ${describeMedia(state)}`;
    }

    play() {
        const media = parseProjectorLink(this.input.value);
        if (media?.error === 'clip') {
            this.status.textContent = 'Los clips de Twitch no se pueden poner; usa el canal o el vídeo entero.';
            return;
        }
        if (!media) {
            this.status.textContent = 'Ese enlace no parece de YouTube ni de Twitch.';
            return;
        }
        this.game.projectorSync.play(this.roomId, media);
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
