import { FloatingPanel } from './FloatingPanel';
import {
    saveName, saveModel, hasSeenCustomizePrompt, markCustomizePromptSeen
} from '../core/PlayerProfile';

// 👤 menu to change nick and character from inside the bar, applied live
// (setUsername → userUsername to everyone). Reuses the start dialog's
// character tiles; their previews are created the first time it opens.
// The nick field goes away once the forum provides the username.
export class CustomizeUI {
    constructor(game) {
        this.game = game;
        this.modelSelector = game.ui.modelSelector;
        this.panel = new FloatingPanel('customize-panel', '👤 Personaliza tu personaje');
        this.panel.onClose = () => this.modelSelector.setPreviewsActive(false);

        const label = document.createElement('label');
        label.className = 'floating-panel-note';
        label.htmlFor = 'customize-name';
        label.textContent = 'Tu nombre';
        this.nameInput = document.createElement('input');
        this.nameInput.id = 'customize-name';
        this.nameInput.type = 'text';
        this.nameInput.maxLength = 15;
        this.nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.saveName();
        });
        const saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.className = 'floating-panel-button';
        saveButton.textContent = 'Guardar';
        saveButton.addEventListener('click', () => this.saveName());
        const nameRow = document.createElement('div');
        nameRow.className = 'customize-name-row';
        nameRow.append(this.nameInput, saveButton);
        this.panel.body.append(label, nameRow);

        this.modelSelector.onModelChange((modelId) => this.applyModel(modelId));

        this.button = document.createElement('button');
        this.button.id = 'customize-button';
        this.button.type = 'button';
        this.button.textContent = '👤';
        this.button.title = 'Personalizar personaje';
        this.button.setAttribute('aria-label', 'Personalizar personaje');
        this.button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.panel.isOpen ? this.panel.close() : this.open();
        });
        document.getElementById('chat-container')?.appendChild(this.button);
    }

    open() {
        if (!this.tiles) {
            // Move the character tiles out of the (hidden) start dialog.
            this.tiles = document.querySelector('.model-selector');
            if (this.tiles) this.panel.body.appendChild(this.tiles);
        }
        this.nameInput.value = this.game.username ?? '';
        this.panel.open();
        // After FloatingPanel.open unhides it: previews size themselves from
        // their (now visible) containers.
        setTimeout(() => {
            this.modelSelector.init();
            this.modelSelector.resizePreviews();
            this.modelSelector.setPreviewsActive(true);
        });
    }

    // Guardar / Enter: apply the nick (if it changed) and close the menu.
    saveName() {
        const name = this.nameInput.value.trim();
        if (!name) return;
        this.panel.close();
        if (name === this.game.username) return;
        this.game.username = name;
        saveName(name);
        this.sendIdentity();
        this.game.ui.chat.addMessage({ type: 'system', message: `👤 Ahora te llamas ${name}.` });
    }

    async applyModel(modelId) {
        const player = this.game.players.localPlayer;
        if (!player) return;
        saveModel(modelId);
        await player.setModel(modelId);
        this.sendIdentity();
    }

    sendIdentity() {
        this.game.network.send('setUsername', {
            username: this.game.username,
            selectedModel: this.modelSelector.getSelectedModel()
        });
    }

    // Direct links only, once per browser: offer the menu after entering.
    maybeAskOnFirstVisit() {
        // Called again after every reconnect; one popup is enough.
        if (this.promptShown || hasSeenCustomizePrompt()) return;
        this.promptShown = true;
        const prompt = new FloatingPanel('customize-prompt', '👋 ¡Bienvenido!');
        const text = document.createElement('div');
        text.textContent = '¿Quieres personalizar tu personaje?';
        const actions = document.createElement('div');
        actions.className = 'floating-panel-actions';
        const yes = document.createElement('button');
        yes.type = 'button';
        yes.className = 'floating-panel-button';
        yes.textContent = 'Sí';
        const no = document.createElement('button');
        no.type = 'button';
        no.className = 'floating-panel-button secondary';
        no.textContent = 'No';
        actions.append(yes, no);
        prompt.body.append(text, actions);

        // Any way of closing it (No, ✕, Esc, clicking outside) counts as an answer.
        prompt.onClose = () => {
            markCustomizePromptSeen();
            setTimeout(() => prompt.element.remove());
        };
        no.addEventListener('click', () => prompt.close());
        yes.addEventListener('click', () => {
            prompt.close();
            this.open();
        });
        prompt.open();
    }
}
