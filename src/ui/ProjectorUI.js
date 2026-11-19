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

        // Twitch (and sometimes YouTube) show prompts on their own player that
        // need a click: content warnings, "click to unmute", "start watching".
        this.touchButton = this.makeButton('🖱️ Tocar la pantalla', 'secondary', () => this.startTouch());
        this.touchButton.title = 'Para aceptar los avisos de Twitch o YouTube en la pantalla';
        this.createTouchBar();

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

        const touchNote = document.createElement('div');
        touchNote.className = 'floating-panel-note';
        touchNote.textContent = '¿Twitch o YouTube piden aceptar algo (contenido para adultos, activar sonido…)? '
            + 'Pulsa «Tocar la pantalla» y haz clic en el aviso. Cada uno lo acepta en su pantalla.';

        this.panel.body.append(this.form, this.status, actions, this.touchButton, touchNote, karaoke, note);
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
        this.touchButton.disabled = !active;
        if (this.touching && !this.touching.state) this.endTouch(); // turned off meanwhile
        this.pauseButton.textContent = state?.pausedAt !== null && active ? '▶ Reanudar' : '⏸ Pausar';
        this.status.textContent = !active
            ? 'Apagado.'
            : `${state.pausedAt !== null ? 'En pausa' : 'Reproduciendo'}: ${describeMedia(state)}`;
    }

    // The exit bar while touching the screen (styled like the web games' one).
    createTouchBar() {
        this.touchBar = document.createElement('div');
        this.touchBar.id = 'projector-exit';
        this.touchBar.className = 'hidden';
        this.touchLink = document.createElement('a');
        this.touchLink.target = '_blank';
        this.touchLink.rel = 'noopener noreferrer';
        const exit = document.createElement('button');
        exit.type = 'button';
        exit.textContent = '✕ Salir';
        exit.addEventListener('click', () => this.endTouch());
        this.touchBar.append(this.touchLink, exit);
        document.body.appendChild(this.touchBar);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.touching) this.endTouch();
        });
    }

    // Camera on the screen, mouse to the embed, movement off (playMode).
    startTouch() {
        const projector = this.projector;
        if (!projector?.state || this.touching || this.game.playMode) return;
        this.panel.close();
        this.touching = projector;
        this.game.playMode = { hint: 'Haz clic en la pantalla para aceptar el aviso · Esc o ✕ Salir para volver' };
        this.game.players.localPlayer?.stopMoving?.();
        const view = projector.getViewpoint(this.game.camera.getCamera());
        this.game.camera.setView(view.position, view.lookAt);
        projector.setInteractive(true);
        document.body.classList.add('screen-touching');
        const state = projector.state;
        this.touchLink.href = state.provider === 'twitch' ? `https://www.twitch.tv/${state.videoId}`
            : state.provider === 'twitch-vod' ? `https://www.twitch.tv/videos/${state.videoId}`
                : `https://www.youtube.com/watch?v=${state.videoId}`;
        this.touchLink.textContent = state.provider?.startsWith('twitch') ? '↗ Abrir en Twitch' : '↗ Abrir en YouTube';
        this.touchBar.classList.remove('hidden');
    }

    endTouch() {
        const projector = this.touching;
        if (!projector) return;
        this.touching = null;
        projector.setInteractive(false);
        document.body.classList.remove('screen-touching');
        this.touchBar.classList.add('hidden');
        this.game.camera.clearView();
        this.game.playMode = null;
        projector.kick(); // sound on, if the prompt was "click to unmute"
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
