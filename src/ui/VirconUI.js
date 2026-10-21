import { FloatingPanel } from './FloatingPanel';

const ROMS_URL = '/vircon32/roms/roms.json';
const CONTROLS_HINT = 'Esc para salir · Flechas, X Z S A, Q W, Enter = Start · Rueda: mover cámara · R: centrar';

// Vircon32 cabinet UI: the ROM picker (bundled games from roms.json, or your
// own .v32 file) and the play session. While playing, the camera frames the
// cabinet screen, the avatar stands in front of it, and the keyboard goes to
// the emulator iframe. Esc (sent by the iframe, or pressed in the page)
// leaves and unloads the emulator.
export class VirconUI {
    constructor(game) {
        this.game = game;
        this.panel = new FloatingPanel('vircon-panel', '🎮 Vircon32');
        this.roomId = null;
        this.roms = null;
        this.session = null; // { roomId, cabinet, rom }

        this.status = document.createElement('div');
        this.status.className = 'floating-panel-note';
        this.list = document.createElement('div');
        this.list.className = 'vircon-roms';

        const upload = document.createElement('label');
        upload.className = 'floating-panel-button secondary vircon-upload';
        upload.textContent = '📂 Cargar mi .v32';
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = '.v32';
        this.fileInput.hidden = true;
        this.fileInput.addEventListener('change', () => this.playFile());
        upload.appendChild(this.fileInput);

        const help = document.createElement('div');
        help.className = 'floating-panel-note';
        help.textContent = `Controles: ${CONTROLS_HINT}. Juegos y créditos: vircon32.com`;

        this.panel.body.append(this.status, this.list, upload, help);

        window.addEventListener('message', (event) => this.handleFrameMessage(event));
        window.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.session) this.endPlay();
        });
        // A click in the page takes the keyboard from the game; give it back
        // (unless the click was into a text field, e.g. the chat).
        document.addEventListener('pointerdown', (event) => {
            if (!this.session || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) return;
            setTimeout(() => this.session?.cabinet.focusGame(), 0);
        });
    }

    async loadRoms() {
        if (this.roms) return this.roms;
        try {
            const response = await fetch(ROMS_URL);
            this.roms = response.ok ? await response.json() : [];
        } catch {
            this.roms = [];
        }
        return this.roms;
    }

    async open(roomId) {
        this.roomId = roomId;
        const contents = this.game.environment.rooms.get(roomId);
        this.panel.setTitle(`🎮 Vircon32 · ${contents?.room.name ?? ''}`);
        const occupant = contents?.vircon.occupant;
        const busy = occupant && occupant.playerId !== this.game.players.localPlayer?.id;
        this.status.textContent = busy
            ? `${occupant.playerName} está jugando a ${occupant.romTitle}. Espera tu turno.`
            : 'Elige un juego:';
        this.fileInput.disabled = Boolean(busy);

        this.list.innerHTML = '';
        (await this.loadRoms()).forEach(rom => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'radio-station vircon-rom';
            button.disabled = Boolean(busy);
            const name = document.createElement('span');
            name.className = 'radio-station-name';
            name.textContent = rom.title;
            const info = document.createElement('span');
            info.className = 'radio-station-genre';
            // Big cartridges take a while to download; say so up front.
            const size = rom.sizeMB >= 1 ? ` · ${Math.round(rom.sizeMB)} MB` : '';
            info.textContent = `${rom.description} · ${rom.author}${size}`;
            button.append(name, info);
            button.addEventListener('click', () => this.play({ title: rom.title, url: `roms/${rom.file}` }));
            this.list.appendChild(button);
        });
        this.panel.open();
    }

    play(rom) {
        this.panel.close();
        this.game.virconSync.request(this.roomId, rom);
    }

    playFile() {
        const file = this.fileInput.files?.[0];
        this.fileInput.value = '';
        if (!file) return;
        if (!/\.v32$/i.test(file.name)) {
            this.status.textContent = 'Eso no es un cartucho .v32.';
            return;
        }
        // Same-origin blob URL: the emulator page fetches it like a bundled ROM.
        this.play({ title: file.name.replace(/\.v32$/i, ''), url: URL.createObjectURL(file), isBlob: true });
    }

    // Called by VirconSync once the server gives us the cabinet.
    beginPlay(roomId, rom) {
        const cabinet = this.game.environment.rooms.get(roomId)?.vircon;
        const player = this.game.players.localPlayer;
        if (!cabinet || !player) return;
        if (this.session) this.endPlay();

        this.session = { roomId, cabinet, rom };
        this.game.playMode = { hint: CONTROLS_HINT };
        const { stand, screen } = cabinet.getViewpoints(this.game.camera.getCamera());
        player.position.copy(stand);
        player.rotation = Math.atan2(screen.x - stand.x, screen.z - stand.z);
        player.keysPressed = {};
        player.isMoving = false;

        const iframe = cabinet.startLocal(rom.url);
        iframe.addEventListener('load', () => {
            cabinet.focusGame();
            iframe.contentWindow?.addEventListener('keydown', (event) => {
                if (event.key.toLowerCase() === 'r' && !event.repeat) this.game.camera.reset();
            });
        });
        this.update();
    }

    endPlay() {
        const session = this.session;
        if (!session) return;
        this.session = null;
        session.cabinet.stopLocal();
        if (session.rom.isBlob) URL.revokeObjectURL(session.rom.url);
        this.game.virconSync.release(session.roomId);
        this.game.camera.clearView();
        this.game.playMode = null;
        window.focus();
    }

    handleFrameMessage(event) {
        const session = this.session;
        if (!session || event.origin !== window.location.origin) return;
        if (event.source !== session.cabinet.iframe?.contentWindow) return;
        const { type, detail } = event.data || {};
        if (type === 'vircon:ready') session.cabinet.focusGame();
        if (type === 'vircon:escape') this.endPlay();
        if (type === 'vircon:error') {
            console.warn('Vircon32:', detail);
            this.game.ui.chat?.addMessage({ type: 'system', message: '🎮 No se ha podido cargar ese juego.' });
            this.endPlay();
        }
    }

    // Every frame while playing: keep the camera on the screen (aspect can change).
    update() {
        if (!this.session) return;
        const camera = this.game.camera.getCamera();
        const { camera: position, screen } = this.session.cabinet.getViewpoints(camera);
        this.game.camera.setView(position, screen);
    }
}
