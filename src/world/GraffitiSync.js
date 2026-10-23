import { FloatingPanel } from '../ui/FloatingPanel';
import { GRAFFITI_COLORS, GRAFFITI_SIZES, ERASER, WALL_COLOR } from './GraffitiWall';

// Bathroom graffiti (server: server/features/graffiti.js), four walls per
// bathroom (id `<roomId>:<index>`). F at a wall opens a panel showing its
// own canvas; drawing on it adds segments
// locally at once and sends them in small batches; everyone else gets them
// from the server, and late joiners get the whole wall.
const SEND_INTERVAL = 100; // ms between batches
const MAX_BATCH = 60;      // segments per message (the server's cap)
const MIN_STEP = 0.004;    // wall units between points of a stroke
const round = (value) => Math.round(value * 1000) / 1000;

export class GraffitiSync {
    constructor(game) {
        this.game = game;
        this.color = 0;
        this.size = 1;
        this.pending = [];
        this.wall = null; // the GraffitiWall in the panel
        this.createPanel();
        setInterval(() => this.flush(), SEND_INTERVAL);
    }

    wallFor(wallId) {
        const [roomId, index] = String(wallId).split(':');
        return this.game.environment.rooms.get(roomId)?.graffiti?.[Number(index)] ?? null;
    }

    createPanel() {
        this.panel = new FloatingPanel('graffiti-panel', '🖍️ Pared del baño');
        this.panel.onClose = () => {
            this.flush();
            this.stroke = null;
            this.wall?.canvas.remove();
            this.wall = null;
        };

        const tools = document.createElement('div');
        tools.className = 'graffiti-tools';
        this.colorButtons = [...GRAFFITI_COLORS, WALL_COLOR].map((color, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'graffiti-color';
            button.style.background = color;
            button.title = index === ERASER ? 'Borrador' : 'Color';
            if (index === ERASER) button.textContent = '🧽';
            button.addEventListener('click', () => this.setColor(index));
            tools.appendChild(button);
            return button;
        });
        this.sizeButtons = GRAFFITI_SIZES.map((size, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'graffiti-size';
            const dot = document.createElement('span');
            dot.style.width = dot.style.height = `${4 + index * 5}px`;
            button.appendChild(dot);
            button.title = ['Fino', 'Medio', 'Gordo'][index];
            button.addEventListener('click', () => this.setSize(index));
            tools.appendChild(button);
            return button;
        });

        this.surface = document.createElement('div');
        this.surface.className = 'graffiti-surface';
        const note = document.createElement('div');
        note.className = 'floating-panel-note';
        note.textContent = 'Lo que pintes lo ve todo el bar. Sé creativo… o no.';
        this.panel.body.append(tools, this.surface, note);
        this.setColor(0);
        this.setSize(1);

        // Pointer drawing (mouse, pen, touch) on the canvas inside the panel.
        this.surface.addEventListener('pointerdown', (event) => {
            if (!this.wall || event.target !== this.wall.canvas) return;
            event.preventDefault();
            this.wall.canvas.setPointerCapture(event.pointerId);
            this.stroke = { pointerId: event.pointerId, last: this.toWall(event) };
            this.addSegment(this.stroke.last, this.stroke.last);
        });
        this.surface.addEventListener('pointermove', (event) => {
            if (!this.stroke || event.pointerId !== this.stroke.pointerId) return;
            const point = this.toWall(event);
            if (Math.hypot(point.x - this.stroke.last.x, point.y - this.stroke.last.y) < MIN_STEP) return;
            this.addSegment(this.stroke.last, point);
            this.stroke.last = point;
        });
        const end = (event) => {
            if (this.stroke?.pointerId === event.pointerId) this.stroke = null;
        };
        this.surface.addEventListener('pointerup', end);
        this.surface.addEventListener('pointercancel', end);
    }

    setColor(index) {
        this.color = index;
        this.colorButtons.forEach((button, i) => button.classList.toggle('selected', i === index));
    }

    setSize(index) {
        this.size = index;
        this.sizeButtons.forEach((button, i) => button.classList.toggle('selected', i === index));
    }

    toWall(event) {
        const rect = this.wall.canvas.getBoundingClientRect();
        return {
            x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
            y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
        };
    }

    addSegment(from, to) {
        const segment = [round(from.x), round(from.y), round(to.x), round(to.y), this.color, this.size];
        this.wall.addSegments([segment]);
        this.pending.push({ wallId: this.wall.id, segment });
    }

    // One message per call (the server rate-limits per user); anything left
    // goes on the next tick.
    flush() {
        if (this.pending.length === 0) return;
        const { wallId } = this.pending[0];
        const batch = [];
        const rest = [];
        this.pending.forEach(item => {
            if (item.wallId === wallId && batch.length < MAX_BATCH) batch.push(item.segment);
            else rest.push(item);
        });
        this.pending = rest;
        this.game.network.send('graffitiDraw', { wallId, segments: batch });
    }

    bind() {
        const { network } = this.game;
        network.on('graffitiStates', (data) => {
            Object.entries(data.walls || {}).forEach(([wallId, segments]) => {
                const wall = this.wallFor(wallId);
                if (!wall || !Array.isArray(segments)) return;
                wall.setSegments(segments);
                // Upload it now (on joining), not on the first look into the bathroom.
                this.game.renderer.renderer.initTexture(wall.texture);
            });
        });
        network.on('graffitiDraw', (data) => {
            if (Array.isArray(data.segments)) this.wallFor(data.wallId)?.addSegments(data.segments);
        });
    }

    // From the interaction (already checked to be inside that bathroom).
    open(wall) {
        if (!wall) return;
        this.wall = wall;
        this.surface.replaceChildren(wall.canvas);
        this.panel.open();
    }

    update() {
        // Walked out with the panel open: it no longer applies.
        const player = this.game.players.localPlayer;
        if (this.panel.isOpen && this.wall && player && !this.wall.bathroom.containsPoint(player.position)) {
            this.panel.close();
        }
    }
}
