import { PTT_KEY } from './VoiceUI';

// Mic settings panel, opened with the ⚙️ button next to the mic button:
// input device picker (remembered), live input level meter, and a button to
// release the mic so the browser's recording indicator goes away.
export class VoiceSettingsUI {
    constructor(voice) {
        this.voice = voice;
        this.isOpen = false;
        this.meter = null;
        this.createElements();

        this.voice.on('mic', () => {
            if (!this.isOpen) return;
            this.refresh();
            this.startMeter();
        });
        this.voice.on('devices', () => this.isOpen && this.refresh());
    }

    createElements() {
        const container = document.getElementById('chat-container');

        this.toggleButton = document.createElement('button');
        this.toggleButton.id = 'voice-settings-button';
        this.toggleButton.type = 'button';
        this.toggleButton.textContent = '⚙️';
        this.toggleButton.title = 'Ajustes del micrófono';
        this.toggleButton.setAttribute('aria-label', 'Ajustes del micrófono');
        this.toggleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.isOpen ? this.close() : this.open();
        });
        container?.appendChild(this.toggleButton);

        this.panel = document.createElement('div');
        this.panel.id = 'voice-settings';
        this.panel.className = 'hidden';
        this.panel.innerHTML = `
            <div class="voice-settings-title">🎙️ Micrófono</div>
            <label class="voice-settings-label" for="voice-device-select">Dispositivo</label>
            <select id="voice-device-select"></select>
            <button type="button" class="voice-settings-action" data-action="allow">Permitir micrófono</button>
            <div class="voice-meter" aria-label="Nivel de entrada"><div class="voice-meter-fill"></div></div>
            <div class="voice-settings-hint"></div>
            <button type="button" class="voice-settings-action secondary" data-action="release">Desactivar micrófono</button>
        `;
        container?.appendChild(this.panel);

        this.select = this.panel.querySelector('select');
        this.allowButton = this.panel.querySelector('[data-action="allow"]');
        this.releaseButton = this.panel.querySelector('[data-action="release"]');
        this.meterFill = this.panel.querySelector('.voice-meter-fill');
        this.hint = this.panel.querySelector('.voice-settings-hint');

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

    open() {
        this.isOpen = true;
        this.panel.classList.remove('hidden');
        this.toggleButton.classList.add('active');
        this.refresh();
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
        this.hint.textContent = hasMic
            ? `Habla para probar. Mantén ${PTT_KEY.toUpperCase()} para que te oigan.`
            : 'El micrófono está apagado; se activa al pulsar para hablar.';
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
