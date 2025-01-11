import { emotesList } from './emotes.js';

export class EmotesUI {
    constructor(chatInput, onEmoteSelect) {
        this.chatInput = chatInput;
        this.onEmoteSelect = onEmoteSelect;
        this.isOpen = false;
        this.createEmotesPanel();
        this.setupEventListeners();
    }

    createEmotesPanel() {
        // Crear botón de emotes
        this.emoteButton = document.createElement('button');
        this.emoteButton.id = 'emote-button';
        this.emoteButton.innerHTML = '😊';
        this.emoteButton.style.zIndex = '1002';
        this.chatInput.parentElement.appendChild(this.emoteButton);

        // Crear panel de emotes
        this.emotesPanel = document.createElement('div');
        this.emotesPanel.id = 'emotes-panel';
        this.emotesPanel.className = 'hidden';
        this.emotesPanel.style.zIndex = '1002';

        // Crear grid de emotes
        emotesList.forEach(emote => {
            const emoteElement = document.createElement('div');
            emoteElement.className = 'emote-item';
            emoteElement.innerHTML = emote.emoji;
            emoteElement.title = `/me ${emote.text}`;
            emoteElement.style.fontSize = '24px';
            
            emoteElement.addEventListener('click', () => {
                this.onEmoteSelect(emote);
                this.togglePanel();
            });

            this.emotesPanel.appendChild(emoteElement);
        });

        this.chatInput.parentElement.appendChild(this.emotesPanel);
    }

    setupEventListeners() {
        this.emoteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePanel();
        });

        // Cerrar panel al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!this.emotesPanel.contains(e.target) && !this.emoteButton.contains(e.target)) {
                this.closePanel();
            }
        });
    }

    togglePanel() {
        this.isOpen = !this.isOpen;
        this.emotesPanel.classList.toggle('hidden');
    }

    closePanel() {
        this.isOpen = false;
        this.emotesPanel.classList.add('hidden');
    }
} 