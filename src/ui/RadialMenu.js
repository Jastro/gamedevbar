// A ring of round buttons around the cursor (right click on the 3D view).
// openAt(x, y, items, { onBack }) with items [{ icon, label, onSelect }]:
// picking one closes the ring and runs it; the middle button closes it (or
// goes back a level). Esc or a click elsewhere closes it too.
import { getUIScale } from './UIScale';

const MARGIN = 120; // keeps the whole ring inside the window (at full UI scale)

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

    // x, y in viewport pixels (clientX/Y); so are the ones passed on to onSelect/onBack.
    openAt(x, y, items, { onBack } = {}) {
        // The ring is zoomed with the HUD (--ui-scale): its CSS pixels are
        // `scale` viewport pixels.
        const scale = getUIScale();
        const margin = MARGIN * scale;
        const left = Math.min(Math.max(margin, x), window.innerWidth - margin);
        const top = Math.min(Math.max(margin, y), window.innerHeight - margin);
        this.element.style.left = `${left / scale}px`;
        this.element.style.top = `${top / scale}px`;
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
