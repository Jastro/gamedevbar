export const PTT_KEY = 'v';

const ERROR_MESSAGES = {
    denied: 'No hay permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones.',
    unavailable: 'No se ha encontrado ningún micrófono.',
    unsupported: 'Tu navegador no permite el chat de voz.',
    insecure: 'El chat de voz necesita HTTPS.'
};

// Push-to-talk controls: hold V, or hold the on-screen mic button
// (mouse/touch). Mirrors the voice state on the button.
export class VoiceUI {
    constructor(voice, chat) {
        this.voice = voice;
        this.chat = chat;
        this.createButton();
        this.voice.on('talking', (isTalking) => this.button.classList.toggle('talking', isTalking));
        this.voice.on('error', (reason) => this.chat?.addMessage({
            type: 'system',
            message: `🎙️ ${ERROR_MESSAGES[reason] ?? ERROR_MESSAGES.unavailable}`
        }));
    }

    createButton() {
        const container = document.getElementById('chat-container');
        this.button = document.createElement('button');
        this.button.id = 'voice-button';
        this.button.type = 'button';
        this.button.textContent = '🎙️';
        this.button.title = `Mantén ${PTT_KEY.toUpperCase()} (o este botón) para hablar`;
        this.button.setAttribute('aria-label', 'Pulsar para hablar');
        container?.appendChild(this.button);

        this.button.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.button.setPointerCapture(e.pointerId);
            this.voice.startTalking();
        });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
            this.button.addEventListener(type, () => this.voice.stopTalking());
        });
        // Keep the button from stealing keyboard focus from the game.
        this.button.addEventListener('focus', () => this.button.blur());
    }

    // Called by Game's key handlers; returns true when the key was used.
    handleKey(event, isDown, chatActive) {
        if (event.key.toLowerCase() !== PTT_KEY) return false;
        if (isDown) {
            if (chatActive || event.repeat) return false;
            this.voice.startTalking();
        } else {
            this.voice.stopTalking();
        }
        return true;
    }

    showIntro() {
        this.chat?.addMessage({
            type: 'system',
            message: `🎙️ Mantén ${PTT_KEY.toUpperCase()} para hablar por micrófono (mejor con cascos).`
        });
    }
}
