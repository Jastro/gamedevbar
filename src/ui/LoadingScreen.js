// Full-screen "loading" card for direct joins (/<roomId>), shown instead of
// the start dialog until the local avatar is in the bar.
export class LoadingScreen {
    show(roomName) {
        this.element = document.createElement('div');
        this.element.id = 'loading-screen';
        const title = document.createElement('div');
        title.className = 'loading-title';
        title.textContent = roomName;
        const text = document.createElement('div');
        text.className = 'loading-text';
        text.textContent = 'Cargando la taberna…';
        this.element.append(title, text);
        document.body.appendChild(this.element);
    }

    hide() {
        if (!this.element) return;
        this.element.classList.add('done');
        // Let the fade-out finish before removing it.
        setTimeout(() => this.element?.remove(), 400);
    }
}
