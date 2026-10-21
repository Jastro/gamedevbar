import { emotesList } from './emotes.js';

const EDGE_MARGIN = 8; // px kept between the panel and the window edge

// The emote picker: opened from the 😊 button (above it) or with a right
// click on the 3D view (at the cursor). The panel lives on <body> with fixed
// positioning so it can open anywhere. Future reactions go here too.
export class EmotesUI {
    constructor(chatInput, onEmoteSelect) {
        this.chatInput = chatInput;
        this.onEmoteSelect = onEmoteSelect;
        this.isOpen = false;
        this.createEmotesPanel();
        this.setupEventListeners();
    }

    createEmotesPanel() {
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

        document.body.appendChild(this.emotesPanel);
    }

    setupEventListeners() {
        this.emoteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.isOpen) {
                this.closePanel();
                return;
            }
            const button = this.emoteButton.getBoundingClientRect();
            this.openAt(button.right, button.top - EDGE_MARGIN, 'above');
        });

        // Cerrar panel al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!this.emotesPanel.contains(e.target) && !this.emoteButton.contains(e.target)) {
                this.closePanel();
            }
        });
    }

    togglePanel() {
        if (this.isOpen) this.closePanel();
    }

    // anchor 'cursor': top-left at (x, y); 'above': bottom-right at (x, y).
    // Either way it's kept inside the window.
    openAt(x, y, anchor = 'cursor') {
        this.isOpen = true;
        this.emotesPanel.classList.remove('hidden');
        const { width, height } = this.emotesPanel.getBoundingClientRect();
        let left = anchor === 'above' ? x - width : x;
        let top = anchor === 'above' ? y - height : y;
        left = Math.min(Math.max(EDGE_MARGIN, left), window.innerWidth - width - EDGE_MARGIN);
        top = Math.min(Math.max(EDGE_MARGIN, top), window.innerHeight - height - EDGE_MARGIN);
        this.emotesPanel.style.left = `${left}px`;
        this.emotesPanel.style.top = `${top}px`;
    }

    closePanel() {
        this.isOpen = false;
        this.emotesPanel.classList.add('hidden');
    }
} 