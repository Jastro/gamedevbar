import { FloatingPanel } from './FloatingPanel';
import {
    saveName, saveModel, saveAppearance, hasSeenCustomizePrompt, markCustomizePromptSeen
} from '../core/PlayerProfile';
import { SLOTS, ITEMS, TINTS, NAME_COLORS, SCALE_RANGE } from '../appearance/catalog';

const TABS = [
    { id: 'character', name: 'Personaje' },
    { id: 'accessories', name: 'Accesorios' },
    { id: 'color', name: 'Color' }
];

// 👤 menu to change nick, character, accessories, color and size from inside
// the bar, applied live (setUsername → userUsername to everyone). Reuses the
// start dialog's character tiles; their previews are created the first time
// it opens. The nick field goes away once the forum provides the username.
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
        this.createTabs();

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

    createTabs() {
        const bar = document.createElement('div');
        bar.className = 'customize-tabs';
        this.tabButtons = new Map();
        this.tabPages = new Map();
        TABS.forEach(tab => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = tab.name;
            button.addEventListener('click', () => this.showTab(tab.id));
            bar.appendChild(button);
            this.tabButtons.set(tab.id, button);
            const page = document.createElement('div');
            page.className = 'customize-page';
            this.tabPages.set(tab.id, page);
        });
        this.panel.body.append(bar, ...this.tabPages.values());
        this.choiceButtons = [];
        this.buildAccessoriesPage(this.tabPages.get('accessories'));
        this.buildColorPage(this.tabPages.get('color'));
        this.showTab('character');
    }

    showTab(id) {
        this.tabButtons.forEach((button, tabId) => button.classList.toggle('active', tabId === id));
        this.tabPages.forEach((page, tabId) => page.classList.toggle('hidden', tabId !== id));
    }

    buildAccessoriesPage(page) {
        Object.entries(SLOTS).forEach(([slot, { name }]) => {
            const title = document.createElement('div');
            title.className = 'customize-section';
            title.textContent = name;
            const grid = document.createElement('div');
            grid.className = 'customize-items';
            const options = [{ id: null, icon: '🚫', name: 'Nada' }, ...ITEMS.filter(item => item.slot === slot)];
            options.forEach(item => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'customize-item';
                button.title = item.name;
                const icon = document.createElement('span');
                icon.className = 'customize-item-icon';
                icon.textContent = item.icon;
                const label = document.createElement('span');
                label.textContent = item.name;
                button.append(icon, label);
                button.addEventListener('click', () => this.updateAppearance({ [slot]: item.id }));
                this.choiceButtons.push({ button, key: slot, value: item.id });
                grid.appendChild(button);
            });
            page.append(title, grid);
        });
    }

    buildColorPage(page) {
        const swatchRow = (title, key, colors) => {
            const heading = document.createElement('div');
            heading.className = 'customize-section';
            heading.textContent = title;
            const row = document.createElement('div');
            row.className = 'customize-swatches';
            colors.forEach(color => {
                const swatch = document.createElement('button');
                swatch.type = 'button';
                swatch.className = 'customize-swatch';
                swatch.title = color ?? 'Original';
                if (color) swatch.style.background = color;
                else swatch.textContent = '✕';
                swatch.addEventListener('click', () => this.updateAppearance({ [key]: color }));
                this.choiceButtons.push({ button: swatch, key, value: color });
                row.appendChild(swatch);
            });
            page.append(heading, row);
        };
        swatchRow('Color del personaje', 'tint', TINTS);
        swatchRow('Color del nombre', 'nameColor', NAME_COLORS);

        const heading = document.createElement('div');
        heading.className = 'customize-section';
        heading.textContent = 'Tamaño';
        this.scaleInput = document.createElement('input');
        this.scaleInput.type = 'range';
        this.scaleInput.className = 'customize-scale';
        this.scaleInput.min = String(SCALE_RANGE.min * 100);
        this.scaleInput.max = String(SCALE_RANGE.max * 100);
        this.scaleInput.step = '1';
        // Live while dragging; saved and sent when let go.
        this.scaleInput.addEventListener('input', () => {
            this.updateAppearance({ scale: Number(this.scaleInput.value) / 100 }, false);
        });
        this.scaleInput.addEventListener('change', () => {
            this.updateAppearance({ scale: Number(this.scaleInput.value) / 100 });
            this.scaleInput.blur();
        });
        page.append(heading, this.scaleInput);
    }

    // Merge a change into the local player's appearance; save and share it
    // unless it's a slider still being dragged.
    updateAppearance(change, share = true) {
        const player = this.game.players.localPlayer;
        if (!player) return;
        player.setAppearance({ ...player.appearance, ...change });
        this.refreshChoices();
        if (!share) return;
        saveAppearance(player.appearance);
        this.sendIdentity();
    }

    refreshChoices() {
        const appearance = this.game.players.localPlayer?.appearance;
        if (!appearance) return;
        this.choiceButtons.forEach(({ button, key, value }) => {
            button.classList.toggle('selected', appearance[key] === value);
        });
        this.scaleInput.value = String(Math.round((appearance.scale ?? 1) * 100));
    }

    open() {
        if (!this.tiles) {
            // Move the character tiles out of the (hidden) start dialog.
            this.tiles = document.querySelector('.model-selector');
            if (this.tiles) this.tabPages.get('character').appendChild(this.tiles);
        }
        this.nameInput.value = this.game.username ?? '';
        this.refreshChoices();
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
            selectedModel: this.modelSelector.getSelectedModel(),
            appearance: this.game.players.localPlayer?.appearance
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
