import { PTT_KEY } from './VoiceUI';
import { saveMouseCapture } from '../core/PlayerProfile';

const VOLUME_LABELS = { radio: '📻 Radio', video: '📽️ Proyector', voice: '🗣️ Voces', arcade: '🕹️ Arcade' };

// Settings panel, opened with the ⚙️ button next to the mic button: volume
// sliders (radio, projector, voices; remembered per player), the mouse
// capture option (Camera.captureMouse, remembered), input device picker
// (remembered), live input level meter, a button to release the mic so the
// browser's recording indicator goes away, and voice connection status.
export class VoiceSettingsUI {
    constructor(voice, audioSettings) {
        this.voice = voice;
        this.audioSettings = audioSettings;
        this.isOpen = false;
        this.meter = null;
        this.createElements();

        this.voice.on('mic', () => {
            if (!this.isOpen) return;
            this.refresh();
            this.startMeter();
        });
        this.voice.on('devices', () => this.isOpen && this.refresh());
        this.voice.on('muted', () => this.isOpen && this.refresh());
        this.voice.on('peers', () => this.isOpen && this.renderPeers());
    }

    createElements() {
        const container = document.getElementById('chat-container');

        this.toggleButton = document.createElement('button');
        this.toggleButton.id = 'voice-settings-button';
        this.toggleButton.type = 'button';
        this.toggleButton.textContent = '⚙️';
        this.toggleButton.title = 'Ajustes';
        this.toggleButton.setAttribute('aria-label', 'Ajustes');
        this.toggleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.isOpen ? this.close() : this.open();
        });
        container?.appendChild(this.toggleButton);

        this.panel = document.createElement('div');
        this.panel.id = 'voice-settings';
        this.panel.className = 'hidden';
        this.panel.innerHTML = `
            <div class="voice-settings-title">🔊 Volumen</div>
            <div class="volume-sliders"></div>
            <div class="voice-settings-title">🖱️ Ratón</div>
            <label class="voice-open-mic"><input type="checkbox" data-action="capture-mouse"> Capturar el ratón al girar o mover la cámara (no se sale de la pantalla)</label>
            <div class="voice-settings-title">🎙️ Micrófono</div>
            <label class="voice-settings-label" for="voice-device-select">Dispositivo</label>
            <select id="voice-device-select"></select>
            <button type="button" class="voice-settings-action" data-action="allow">Permitir micrófono</button>
            <div class="voice-meter" aria-label="Nivel de entrada"><div class="voice-meter-fill"></div></div>
            <label class="voice-open-mic"><input type="checkbox" data-action="open-mic"> Micrófono abierto (sin pulsar ${PTT_KEY.toUpperCase()})</label>
            <div class="voice-settings-hint"></div>
            <button type="button" class="voice-settings-action secondary" data-action="release">Desactivar micrófono</button>
            <div class="voice-settings-label">Conexiones de voz</div>
            <ul class="voice-peers"></ul>
        `;
        container?.appendChild(this.panel);

        this.select = this.panel.querySelector('select');
        this.allowButton = this.panel.querySelector('[data-action="allow"]');
        this.releaseButton = this.panel.querySelector('[data-action="release"]');
        this.meterFill = this.panel.querySelector('.voice-meter-fill');
        this.hint = this.panel.querySelector('.voice-settings-hint');
        this.openMicCheckbox = this.panel.querySelector('[data-action="open-mic"]');
        this.openMicCheckbox.addEventListener('change', async () => {
            this.openMicCheckbox.blur();
            await this.voice.setMode(this.openMicCheckbox.checked ? 'open' : 'ptt');
            this.refresh();
        });
        this.captureCheckbox = this.panel.querySelector('[data-action="capture-mouse"]');
        this.captureCheckbox.checked = Boolean(this.voice.game.camera?.captureMouse);
        this.captureCheckbox.addEventListener('change', () => {
            this.captureCheckbox.blur();
            this.voice.game.camera.captureMouse = this.captureCheckbox.checked;
            saveMouseCapture(this.captureCheckbox.checked);
        });
        this.peerList = this.panel.querySelector('.voice-peers');
        this.createVolumeSliders(this.panel.querySelector('.volume-sliders'));

        this.select.addEventListener('change', () => this.voice.setInputDevice(this.select.value));
        this.allowButton.addEventListener('click', () => this.voice.enableMic());
        this.releaseButton.addEventListener('click', () => this.voice.releaseMic());

        // Clicks inside stay inside; clicks anywhere else close the panel.
        this.panel.addEventListener('click', (e) => e.stopPropagation());
        document.addEventListener('click', () => this.isOpen && this.close());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.close();
        });
    }

    createVolumeSliders(container) {
        if (!this.audioSettings) return;
        Object.entries(VOLUME_LABELS).forEach(([category, label]) => {
            const row = document.createElement('label');
            row.className = 'volume-row';
            const name = document.createElement('span');
            name.textContent = label;
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = '0';
            slider.max = '100';
            slider.value = String(Math.round(this.audioSettings.get(category) * 100));
            const value = document.createElement('span');
            value.className = 'volume-value';
            value.textContent = `${slider.value}%`;
            slider.addEventListener('input', () => {
                value.textContent = `${slider.value}%`;
                this.audioSettings.set(category, Number(slider.value) / 100);
            });
            // Give the keys back to the game once the slider is released
            // (a focused input pauses movement, see Game.chatActive).
            slider.addEventListener('change', () => slider.blur());
            row.append(name, slider, value);
            container.appendChild(row);
        });
    }

    open() {
        this.isOpen = true;
        this.panel.classList.remove('hidden');
        this.toggleButton.classList.add('active');
        this.refresh();
        this.renderPeers();
        this.startMeter();
    }

    close() {
        this.isOpen = false;
        this.panel.classList.add('hidden');
        this.toggleButton.classList.remove('active');
        this.stopMeter();
    }

    async refresh() {
        const devices = await this.voice.listInputDevices();
        const hasMic = Boolean(this.voice.micTrack);
        // Without permission browsers hide device names (and often list just one).
        const hasLabels = devices.some(device => device.label);
        const currentId = this.voice.currentDeviceId;

        this.select.innerHTML = '';
        devices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Micrófono ${index + 1}`;
            this.select.appendChild(option);
        });
        if (devices.length === 0) {
            const option = document.createElement('option');
            option.textContent = 'No se ha encontrado ningún micrófono';
            this.select.appendChild(option);
        }
        if (devices.some(device => device.deviceId === currentId)) this.select.value = currentId;

        this.select.disabled = devices.length === 0 || !hasLabels;
        this.allowButton.classList.toggle('hidden', hasLabels && hasMic);
        this.allowButton.textContent = hasLabels ? 'Activar micrófono' : 'Permitir micrófono';
        this.releaseButton.classList.toggle('hidden', !hasMic);
        const open = this.voice.mode === 'open';
        this.openMicCheckbox.checked = open;
        const key = PTT_KEY.toUpperCase();
        if (!hasMic) {
            this.hint.textContent = open
                ? `El micrófono está apagado; ${key} o 🎙️ lo vuelven a abrir.`
                : 'El micrófono está apagado; se activa al pulsar para hablar.';
        } else if (open) {
            this.hint.textContent = this.voice.openMuted
                ? `Silenciado. ${key} o 🎙️ para que te vuelvan a oír.`
                : `Te oyen siempre que hablas. ${key} o 🎙️ para silenciarte.`;
        } else {
            this.hint.textContent = `Habla para probar. Mantén ${key} para que te oigan.`;
        }
    }

    // Who we can hear / be heard by. A failure usually means a network that
    // needs the TURN relay (Docs/TURN.md).
    renderPeers() {
        const labels = { connecting: 'conectando…', connected: 'conectado', failed: 'sin conexión' };
        const peers = this.voice.getPeerStatuses();
        this.peerList.innerHTML = '';
        if (peers.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'voice-peer-empty';
            empty.textContent = 'Nadie más en el bar';
            this.peerList.appendChild(empty);
            return;
        }
        peers.forEach(({ name, status }) => {
            const item = document.createElement('li');
            item.className = `voice-peer ${status}`;
            const nameSpan = document.createElement('span');
            nameSpan.textContent = name;
            const statusSpan = document.createElement('span');
            statusSpan.className = 'voice-peer-status';
            statusSpan.textContent = labels[status] ?? status;
            item.append(nameSpan, statusSpan);
            this.peerList.appendChild(item);
        });
    }

    // Level from a clone of the mic track: the real one is muted (enabled =
    // false) between push-to-talk presses, the clone isn't, and nothing from
    // the clone is sent to anyone.
    startMeter() {
        this.stopMeter();
        const context = this.voice.game.environment.audioListener?.context;
        const track = this.voice.micTrack;
        if (!context || !track) {
            this.meterFill.style.width = '0%';
            return;
        }

        const clone = track.clone();
        clone.enabled = true;
        const source = context.createMediaStreamSource(new MediaStream([clone]));
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        const samples = new Float32Array(analyser.fftSize);

        const tick = () => {
            analyser.getFloatTimeDomainData(samples);
            let sum = 0;
            for (const value of samples) sum += value * value;
            const rms = Math.sqrt(sum / samples.length);
            // Speech sits around 0.02-0.2 RMS; scale so normal talking fills most of the bar.
            this.meterFill.style.width = `${Math.min(100, rms * 400)}%`;
            this.meter.frame = requestAnimationFrame(tick);
        };
        this.meter = { clone, source, frame: requestAnimationFrame(tick) };
    }

    stopMeter() {
        if (!this.meter) return;
        cancelAnimationFrame(this.meter.frame);
        this.meter.source.disconnect();
        this.meter.clone.stop();
        this.meter = null;
        this.meterFill.style.width = '0%';
    }
}
