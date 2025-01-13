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

        // Prevent game controls while typing
        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === ' ' || // Space (jump)
                e.key.toLowerCase() === 'w' || // Movement
                e.key.toLowerCase() === 'a' ||
                e.key.toLowerCase() === 's' ||
                e.key.toLowerCase() === 'd') {
                e.stopPropagation(); // Prevent the event from bubbling up
            }
        });

        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const message = this.chatInput.value.trim();
                if (message) {
                    this.sendMessage(message);
                    this.chatInput.value = '';
                }
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

        const messageDiv = document.createElement('div');
        
        if (messageData.isTaberna) {
            messageDiv.className = 'chat-message taberna-message';
            messageDiv.innerHTML = `<span class="taberna-tag">Taberna</span> ${messageData.message}`;
        } else {
            messageDiv.className = `chat-message ${messageData.isEmote ? 'emote-message' : ''}`;
            const username = messageData.username || messageData.userId;
            if (messageData.isEmote) {
                messageDiv.innerHTML = `* <strong>${username}</strong> ${messageData.message}`;
            } else {
                messageDiv.innerHTML = `<strong>${username}</strong> ${messageData.message}`;
            }
        }

        this.chatBox.appendChild(messageDiv);
        this.chatBox.scrollTop = this.chatBox.scrollHeight;

        while (this.chatBox.children.length > this.maxMessages) {
            this.chatBox.removeChild(this.chatBox.firstChild);
        }

        if (!messageData.isTaberna && window.game?.players?.players) {
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