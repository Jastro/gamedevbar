import { EmotesUI } from './EmotesUI';
import { getUIScale } from './UIScale';

const KEEP_OPEN_KEY = 'chatKeepOpen';
const SIZE_KEY = 'chatSize';
// The chat frame's size in CSS pixels (before --ui-scale): default, minimum,
// and room kept free (the round buttons on the right, a margin on top).
const DEFAULT_SIZE = { width: 482, height: 432 };
const MIN_SIZE = { width: 300, height: 150 };
const RIGHT_ROOM = 280; // left margin + the buttons at the bottom right
const TOP_ROOM = 110;   // the frame's bottom offset + a margin above it

export class ChatUI {
    constructor() {
        this.chatFrame = document.getElementById('chat-box');
        this.chatBox = document.getElementById('chat-log'); // where messages go
        this.chatInput = null;
        this.chatContainer = null;
        this.emotesUI = null;
        this.lastChatTime = 0;
        this.chatTimeout = null;
        this.chatActive = false;
        this.maxMessages = 50;
        this.messages = [];
        // Settings (⚙️ → Chat): keep typing after sending instead of going back
        // to the game. Enter on an empty box or Esc still closes it.
        this.keepOpen = false;
        try {
            this.keepOpen = localStorage.getItem(KEEP_OPEN_KEY) === '1';
        } catch {
            // Storage unavailable: default (closes after sending).
        }

        this.init();
    }

    init() {
        this.createChatElements();
        this.setupEventListeners();
        this.setupResize();
    }

    createChatElements() {
        this.chatFrame = document.getElementById('chat-box');
        this.chatBox = document.getElementById('chat-log');
        if (!this.chatBox || !this.chatFrame) {
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
                // Back to the game, unless the player keeps the chat open
                // (then only an empty Enter closes it).
                if (!message || !this.keepOpen) this.chatInput.blur();
            }
        });

        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.chatInput.blur();
        });
    }

    // Drag the frame's top-right corner to resize the chat (it grows up and
    // to the right; the input below follows its width). Remembered; double
    // click goes back to the default size.
    setupResize() {
        const handle = this.chatFrame?.querySelector('.chat-resize-handle');
        if (!handle) return;
        let saved = null;
        try {
            saved = JSON.parse(localStorage.getItem(SIZE_KEY) || 'null');
        } catch {
            // Corrupt or unavailable: default size.
        }
        this.size = { ...DEFAULT_SIZE, ...(saved && typeof saved === 'object' ? saved : {}) };
        this.applySize(this.size);

        let drag = null;
        handle.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handle.setPointerCapture(e.pointerId);
            const shown = this.chatFrame.getBoundingClientRect();
            const scale = getUIScale();
            drag = { x: e.clientX, y: e.clientY, width: shown.width / scale, height: shown.height / scale, scale };
            this.chatFrame.classList.add('resizing');
        });
        handle.addEventListener('pointermove', (e) => {
            if (!drag) return;
            this.applySize({
                width: drag.width + (e.clientX - drag.x) / drag.scale,
                height: drag.height - (e.clientY - drag.y) / drag.scale
            });
        });
        const end = (e) => {
            if (!drag) return;
            drag = null;
            if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
            this.chatFrame.classList.remove('resizing');
            this.saveSize();
        };
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
        // Keep these from reaching the 3D world (InteractionSystem) or panels.
        ['click', 'mousedown'].forEach(type => handle.addEventListener(type, (e) => e.stopPropagation()));
        handle.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.applySize(DEFAULT_SIZE);
            this.saveSize();
        });
        // A smaller window (or UI scale) may no longer fit the chosen size.
        window.addEventListener('resize', () => this.applySize(this.size));
    }

    // `wanted`: the size the player chose. What's shown is that, kept within
    // the window (and never under the minimum); the choice itself is kept,
    // so it comes back when the window grows again.
    applySize(wanted) {
        this.size = {
            width: Math.max(MIN_SIZE.width, Math.round(Number(wanted.width) || DEFAULT_SIZE.width)),
            height: Math.max(MIN_SIZE.height, Math.round(Number(wanted.height) || DEFAULT_SIZE.height))
        };
        const scale = getUIScale();
        const width = Math.min(this.size.width, Math.max(MIN_SIZE.width, window.innerWidth / scale - RIGHT_ROOM));
        const height = Math.min(this.size.height, Math.max(MIN_SIZE.height, window.innerHeight / scale - TOP_ROOM));
        const atBottom = this.isScrolledToBottom();
        const root = document.documentElement.style;
        root.setProperty('--chat-width', `${Math.round(width)}px`);
        root.setProperty('--chat-height', `${Math.round(height)}px`);
        // Wrapping changes the log's height: stay on the newest message.
        if (atBottom) this.chatBox.scrollTop = this.chatBox.scrollHeight;
    }

    isScrolledToBottom() {
        const log = this.chatBox;
        return !log || log.scrollHeight - log.scrollTop - log.clientHeight < 24;
    }

    saveSize() {
        try {
            localStorage.setItem(SIZE_KEY, JSON.stringify(this.size));
        } catch {
            // Not critical: the size just won't be remembered.
        }
    }

    setKeepOpen(keepOpen) {
        this.keepOpen = Boolean(keepOpen);
        try {
            localStorage.setItem(KEEP_OPEN_KEY, this.keepOpen ? '1' : '0');
        } catch {
            // Not critical: the setting just won't be remembered.
        }
    }

    handleEmote(emote) {
        this.sendMessage(`/me ${emote.text}`, true, emote.emoji);
    }

    sendMessage(message, isEmote = false, emoji = null) {
        if (message.startsWith('/me ')) {
            isEmote = true;
            message = message.substring(4);
        }
        // Drunk players type like it (emotes from the menu stay intact).
        if (!emoji && !message.startsWith('/') && window.game?.drinkSync) message = window.game.drinkSync.slur(message);

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
        this.chatFrame.classList.remove('hidden');
        this.chatContainer.classList.remove('hidden');
    }

    hide() {
        this.chatFrame.classList.add('hidden');
        this.chatContainer.classList.add('hidden');
    }

    isChatActive() {
        return this.chatActive;
    }
}