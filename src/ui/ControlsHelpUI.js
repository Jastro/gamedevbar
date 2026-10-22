import { FloatingPanel } from './FloatingPanel';

// ❔ button next to 👤: every control in one panel. Keep this list in sync
// when a key changes (Camera.js, LocalPlayer.js, InteractionSystem.js,
// VoiceUI.js, VirconUI.js).
const SECTIONS = [
    {
        title: 'En el bar',
        rows: [
            ['W A S D', 'Andar (Mayús: correr)'],
            ['Espacio', 'Saltar (también a las mesas)'],
            ['F o clic', 'Puertas, sillas, radio, proyector, máquinas e interruptores de luz'],
            ['Baño (F o clic)', 'Puerta y pestillo, váter, cadena, lavabo, ambientador, luz y pintar en la pared'],
            ['Barra (F o clic en el grifo)', 'Pedir una bebida'],
            ['B', 'Beber'],
            ['Karaoke (F en el micro o salta al escenario)', 'Tu voz llega a todo el bar; la letra, en el proyector'],
            ['Dardos (F en la línea amarilla)', 'Ratón: apuntar · Clic o Espacio: lanzar · Esc: salir'],
            ['Q / E', 'Girar la cámara'],
            ['Clic derecho + arrastrar', 'Girar la cámara'],
            ['Rueda', 'Acercar / alejar'],
            ['Clic en la rueda + arrastrar', 'Mover la cámara'],
            ['R', 'Centrar la cámara'],
            ['Clic derecho', 'Emojis'],
            ['V (mantener)', 'Hablar por micrófono (en ⚙️: micrófono abierto)'],
            ['Enter', 'Escribir en el chat (Enter envía, /me para acciones)'],
            ['Esc', 'Cerrar paneles y emojis']
        ]
    },
    {
        title: 'En la máquina Vircon32',
        rows: [
            ['Flechas', 'Mando'],
            ['X Z S A', 'Botones A B X Y'],
            ['Q W', 'Gatillos L R'],
            ['Enter', 'Start'],
            ['V / R', 'Hablar / centrar la cámara'],
            ['Esc', 'Salir de la máquina']
        ]
    }
];

export class ControlsHelpUI {
    constructor() {
        this.panel = new FloatingPanel('controls-panel', '❔ Controles');
        SECTIONS.forEach(section => {
            const title = document.createElement('div');
            title.className = 'controls-section';
            title.textContent = section.title;
            const list = document.createElement('dl');
            list.className = 'controls-list';
            section.rows.forEach(([keys, action]) => {
                const term = document.createElement('dt');
                term.textContent = keys;
                const description = document.createElement('dd');
                description.textContent = action;
                list.append(term, description);
            });
            this.panel.body.append(title, list);
        });

        this.button = document.createElement('button');
        this.button.id = 'help-button';
        this.button.type = 'button';
        this.button.textContent = '❔';
        this.button.title = 'Controles';
        this.button.setAttribute('aria-label', 'Controles');
        this.button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.panel.isOpen ? this.panel.close() : this.panel.open();
        });
        document.getElementById('chat-container')?.appendChild(this.button);
    }
}
