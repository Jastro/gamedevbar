import { EmotesUI } from './EmotesUI';
import { Config } from '../core/Config';

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
        // Chat Box
        this.chatBox = document.getElementById('chat-box');
        if (!this.chatBox) {
            console.error('Chat box element not found');
            return;
        }

        // Chat Input Container
        this.chatContainer = document.getElementById('chat-container');
        if (!this.chatContainer) {
            console.error('Chat container element not found');
            return;
        }

        // Chat Input
        this.chatInput = document.getElementById('chat-input');
        if (!this.chatInput) {
            console.error('Chat input element not found');
            return;
        }

        // Inicializar EmotesUI
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

        // Enviar a través del WebSocket (necesitarás implementar esto)
        if (window.game && window.game.network) {
            window.game.network.send(messageData);
        }

        // Mostrar mensaje localmente
        this.addMessageToChat('local', message, isEmote);
    }

    addMessage(messageData) {
        // Guardar mensaje en el histórico
        this.messages.push(messageData);
        if (this.messages.length > this.maxMessages) {
            this.messages.shift();
        }

        // Crear elemento de mensaje
        const messageDiv = document.createElement('div');
        
        if (messageData.isTaberna) {
            messageDiv.className = 'chat-message taberna-message';
            messageDiv.innerHTML = `<span class="taberna-tag">Taberna</span> ${messageData.message}`;
        } else {
            messageDiv.className = `chat-message ${messageData.isEmote ? 'emote-message' : ''}`;
            const username = messageData.username || messageData.userId;
            if (messageData.isEmote) {
                messageDiv.textContent = `* ${username} ${messageData.message}`;
            } else {
                messageDiv.textContent = `${username}: ${messageData.message}`;
            }
        }

        // Añadir al chatBox
        this.chatBox.appendChild(messageDiv);
        this.chatBox.scrollTop = this.chatBox.scrollHeight;

        // Mantener límite de mensajes en el DOM
        while (this.chatBox.children.length > this.maxMessages) {
            this.chatBox.removeChild(this.chatBox.firstChild);
        }
    }

    addMessageToChat(userId, message, isEmote = false, username = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${isEmote ? 'emote-message' : ''}`;
        
        const displayName = username || (userId === 'local' ? 'Tú' : 'Usuario');
        messageDiv.textContent = isEmote ? 
            `* ${displayName} ${message}` : 
            `${displayName}: ${message}`;

        this.chatBox.appendChild(messageDiv);
        this.chatBox.scrollTop = this.chatBox.scrollHeight;

        // Mantener límite de mensajes
        while (this.chatBox.children.length > this.maxMessages) {
            this.chatBox.removeChild(this.chatBox.firstChild);
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