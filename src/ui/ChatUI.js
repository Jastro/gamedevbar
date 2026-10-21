import { EmotesUI } from './EmotesUI';

export class ChatUI {
    constructor() {
        this.chatBox = document.getElementById('chat-box');
        this.chatInput = null;
        this.chatContainer = null;
        this.emotesUI = null;
        this.lastChatTime = 0;
        this.chatTimeout = null;
        this.chatActive = false;
        this.maxMessages = 50;
        this.messages = [];

        this.init();
    }

    init() {
        this.createChatElements();
        this.setupEventListeners();
    }

    createChatElements() {
        this.chatBox = document.getElementById('chat-box');
        if (!this.chatBox) {
            console.error('Chat box element not found');
            return;
        }

        this.chatContainer = document.getElementById('chat-container');
        if (!this.chatContainer) {
            console.error('Chat container element not found');
            return;
        }

        this.chatInput = document.getElementById('chat-input');
        if (!this.chatInput) {
            console.error('Chat input element not found');
            return;
        }

        this.emotesUI = new EmotesUI(this.chatInput, (emote) => this.handleEmote(emote));
    }

    setupEventListeners() {
        if (!this.chatInput) return;

        this.chatInput.addEventListener('focus', () => {
            this.chatActive = true;
        });

        this.chatInput.addEventListener('blur', () => {
            this.chatActive = false;
        });

        // Enter anywhere starts typing (not while another field has focus or
        // while at an arcade screen). preventDefault keeps this Enter from
        // also reaching the input as "send".
        window.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' || this.chatActive || e.repeat) return;
            if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement?.tagName)) return;
            if (window.game?.playMode) return;
            e.preventDefault();
            this.chatInput.focus();
        });

        // Prevent game controls while typing
        this.chatInput.addEventListener('keydown', (e) => {
            if (this.chatActive && (
                e.key === ' ' || // Space (jump)
                e.key.toLowerCase() === 'w' || // Movement
                e.key.toLowerCase() === 'a' ||
                e.key.toLowerCase() === 's' ||
                e.key.toLowerCase() === 'd')) {
                e.stopPropagation(); // Prevent movement while typing
            }
        });

        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const message = this.chatInput.value.trim();
                if (message) {
                    this.sendMessage(message);
                    this.chatInput.value = '';
                }
                this.chatInput.blur(); // Solo quitamos el foco cuando se envía el mensaje
            }
        });
    }

    handleEmote(emote) {
        this.sendMessage(`/me ${emote.text}`, true, emote.emoji);
    }

    sendMessage(message, isEmote = false, emoji = null) {
        if (message.startsWith('/me ')) {
            isEmote = true;
            message = message.substring(4);
        }

        const messageData = {
            type: 'userChat',
            message: message,
            isEmote: isEmote,
            emoji: emoji
        };

        if (window.game?.network) {
            window.game.network.send('userChat', messageData);
        }
    }

    addMessage(messageData) {
        if (!this.chatBox) {
            console.error('Chat box no encontrado');
            return;
        }

        this.messages.push(messageData);
        if (this.messages.length > this.maxMessages) {
            this.messages.shift();
        }

        // Usernames and messages come from other clients (taberna messages embed
        // usernames too), so they only ever go in as text, never as HTML.
        const messageDiv = document.createElement('div');
        const text = String(messageData.message ?? '');

        if (messageData.type === 'system') {
            // Local hints (e.g. "get closer"); they carry no username.
            messageDiv.className = 'chat-message taberna-message';
            messageDiv.textContent = text;
        } else if (messageData.isTaberna) {
            messageDiv.className = 'chat-message taberna-message';
            const tag = document.createElement('span');
            tag.className = 'taberna-tag';
            tag.textContent = 'Taberna';
            messageDiv.append(tag, ` ${text}`);
        } else {
            messageDiv.className = `chat-message ${messageData.isEmote ? 'emote-message' : ''}`;
            const name = document.createElement('strong');
            name.textContent = String(messageData.username || messageData.userId || '');
            if (messageData.isEmote) {
                messageDiv.append('* ');
            }
            messageDiv.append(name, ` ${text}`);
        }

        this.chatBox.appendChild(messageDiv);
        this.chatBox.scrollTop = this.chatBox.scrollHeight;

        while (this.chatBox.children.length > this.maxMessages) {
            this.chatBox.removeChild(this.chatBox.firstChild);
        }

        if (!messageData.isTaberna && messageData.type !== 'system' && window.game?.players?.players) {
            const player = window.game.players.players.get(messageData.userId);
            if (player) {
                player.showChatBubble(messageData.message, messageData.isEmote, messageData.emoji);
            }
        }
    }

    show() {
        this.chatBox.classList.remove('hidden');
        this.chatContainer.classList.remove('hidden');
    }

    hide() {
        this.chatBox.classList.add('hidden');
        this.chatContainer.classList.add('hidden');
    }

    isChatActive() {
        return this.chatActive;
    }
}