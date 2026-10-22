// A ring of round buttons around the cursor (right click on the 3D view).
// openAt(x, y, items, { onBack }) with items [{ icon, label, onSelect }]:
// picking one closes the ring and runs it; the middle button closes it (or
// goes back a level). Esc or a click elsewhere closes it too.
const MARGIN = 120; // keeps the whole ring inside the window

export class RadialMenu {
    constructor() {
        this.element = document.createElement('div');
        this.element.id = 'radial-menu';
        this.element.className = 'hidden';
        document.body.appendChild(this.element);
        this.isOpen = false;
        // Clicks here stay here (never reach the 3D world or close other panels).
        ['click', 'mousedown', 'pointerdown'].forEach(type => {
            this.element.addEventListener(type, (event) => event.stopPropagation());
        });
        document.addEventListener('pointerdown', () => this.isOpen && this.close());
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.isOpen) this.close();
        });
    }

    openAt(x, y, items, { onBack } = {}) {
        const left = Math.min(Math.max(MARGIN, x), window.innerWidth - MARGIN);
        const top = Math.min(Math.max(MARGIN, y), window.innerHeight - MARGIN);
        this.element.style.left = `${left}px`;
        this.element.style.top = `${top}px`;
        this.element.replaceChildren();

        const radius = items.length > 4 ? 92 : 68;
        // Two options read best side by side; more start at the top.
        const start = items.length === 2 ? Math.PI : -Math.PI / 2;
        items.forEach((item, index) => {
            const angle = start + (index / items.length) * Math.PI * 2;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'radial-item';
            button.style.setProperty('--x', `${Math.cos(angle) * radius}px`);
            button.style.setProperty('--y', `${Math.sin(angle) * radius}px`);
            button.style.transitionDelay = `${index * 18}ms`;
            const icon = document.createElement('span');
            icon.className = 'radial-icon';
            icon.textContent = item.icon;
            const label = document.createElement('span');
            label.className = 'radial-label';
            label.textContent = item.label;
            button.append(icon, label);
            button.addEventListener('click', () => {
                this.close();
                item.onSelect(left, top);
            });
            this.element.appendChild(button);
        });

        const center = document.createElement('button');
        center.type = 'button';
        center.className = 'radial-center';
        center.textContent = onBack ? '‹' : '✕';
        center.title = onBack ? 'Atrás' : 'Cerrar';
        center.addEventListener('click', () => {
            this.close();
            onBack?.(left, top);
        });
        this.element.appendChild(center);

        this.element.classList.remove('hidden', 'open');
        this.isOpen = true;
        // Next frame, so the buttons animate out from the middle.
        requestAnimationFrame(() => this.element.classList.add('open'));
    }

    close() {
        this.isOpen = false;
        this.element.classList.add('hidden');
        this.element.classList.remove('open');
    }
}
