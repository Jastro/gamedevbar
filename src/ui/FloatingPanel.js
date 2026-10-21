// Small centered panel for in-world objects (radio, projector). Closes on
// Escape, on the ✕ button or when clicking outside it.
export class FloatingPanel {
    constructor(id, title) {
        this.element = document.createElement('div');
        this.element.id = id;
        this.element.className = 'floating-panel hidden';

        const header = document.createElement('div');
        header.className = 'floating-panel-header';
        this.titleElement = document.createElement('span');
        this.titleElement.textContent = title;
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'floating-panel-close';
        closeButton.textContent = '✕';
        closeButton.setAttribute('aria-label', 'Cerrar');
        closeButton.addEventListener('click', () => this.close());
        header.append(this.titleElement, closeButton);

        this.body = document.createElement('div');
        this.body.className = 'floating-panel-body';
        this.element.append(header, this.body);
        document.body.appendChild(this.element);

        this.isOpen = false;
        // Clicks inside stay inside (and never reach the 3D world).
        this.element.addEventListener('click', (e) => e.stopPropagation());
        this.element.addEventListener('mousedown', (e) => e.stopPropagation());
        document.addEventListener('click', () => this.isOpen && this.close());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.close();
        });
    }

    setTitle(title) {
        this.titleElement.textContent = title;
    }

    open() {
        // Opened from a world click: skip the click that is still bubbling.
        setTimeout(() => {
            this.isOpen = true;
            this.element.classList.remove('hidden');
        });
    }

    close() {
        if (this.isOpen) this.onClose?.();
        this.isOpen = false;
        this.element.classList.add('hidden');
        if (this.element.contains(document.activeElement)) document.activeElement.blur();
    }
}
