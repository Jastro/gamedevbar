// Start dialog: name + character (ModelSelector) + bar (RoomSelector).
// Calls onStart({ username, model, roomId }) once, when "Entrar al Bar" is pressed.
export class StartScreen {
    constructor({ modelSelector, roomSelector, onStart }) {
        this.modelSelector = modelSelector;
        this.roomSelector = roomSelector;
        this.onStart = onStart;
        this.dialog = document.getElementById('username-dialog');
        this.usernameInput = document.getElementById('username-input');
        this.startButton = document.getElementById('start-button');
        this.started = false;
    }

    init() {
        if (!this.dialog || !this.usernameInput || !this.startButton) {
            console.error('Required UI elements not found');
            return;
        }

        this.modelSelector.init();
        this.roomSelector.init();

        this.updateStartButton();
        this.usernameInput.addEventListener('input', () => this.updateStartButton());
        this.modelSelector.onModelChange(() => this.updateStartButton());
        this.usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.startButton.disabled) this.startButton.click();
        });
        this.startButton.addEventListener('click', () => this.start());
    }

    updateStartButton() {
        const hasName = this.usernameInput.value.trim().length > 0;
        this.startButton.disabled = !hasName || !this.modelSelector.hasModelSelected();
    }

    async start() {
        const username = this.usernameInput.value.trim();
        if (!username || this.started) return;
        this.started = true;

        const model = await this.modelSelector.waitForModelSelection();
        this.dialog.classList.add('hidden');
        document.getElementById('chat-container')?.classList.remove('hidden');
        document.getElementById('chat-box')?.classList.remove('hidden');

        await this.onStart({ username, model, roomId: this.roomSelector.getSelectedRoom() });
    }
}
