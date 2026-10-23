import * as THREE from 'three';
import { GALLERY, ROOM_HALF_DEPTH, WALL_THICKNESS } from './RoomLayout';

// The weekly leaderboards (server: server/features/leaderboards.js) on a
// board in each bar, up on the gallery's front wall (right of the terrace
// doorway): the top 5 of each category. ProfileUI shows a player's own.
export const LEADERBOARD_CATEGORIES = [
    { id: 'darts', icon: '🎯', label: 'Dardos', note: 'mejor tirada', format: value => `${value}` },
    { id: 'foosball', icon: '⚽', label: 'Futbolín', note: 'partidos ganados', format: value => `${value}` },
    { id: 'slots', icon: '🎰', label: 'Tragaperras', note: 'mayor premio', format: value => `${value} 🪙` },
    { id: 'lap', icon: '⏱️', label: 'Vuelta rápida', note: 'circuito', format: value => formatLap(value) },
    { id: 'races', icon: '🏁', label: 'Carreras', note: 'ganadas', format: value => `${value}` }
];
const BOARD = { x: 8, width: 5.6, height: 2.4 };
const CANVAS = { width: 1600, height: 686 };

// 63500 → "1:03.5"
export function formatLap(ms) {
    const total = Math.max(0, Math.round(ms / 100)) / 10;
    const minutes = Math.floor(total / 60);
    const seconds = (total - minutes * 60).toFixed(1).padStart(4, '0');
    return `${minutes}:${seconds}`;
}

export class LeaderboardSync {
    constructor(game) {
        this.game = game;
        this.state = { week: '', boards: {} };
        this.boards = [];
    }

    create() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = CANVAS.width;
        this.canvas.height = CANVAS.height;
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.anisotropy = 8;
        this.draw();
        // One canvas for every bar's board (they show the same).
        const material = new THREE.MeshStandardMaterial({
            map: this.texture, emissiveMap: this.texture, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.7
        });
        const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.6 });
        this.game.world.rooms.forEach(room => {
            const group = new THREE.Group();
            group.name = 'LeaderboardBoard';
            const z = ROOM_HALF_DEPTH - WALL_THICKNESS / 2;
            group.position.set(BOARD.x, GALLERY.top + 1.6, z - 0.06);
            group.rotation.y = Math.PI; // facing into the bar
            const frame = new THREE.Mesh(new THREE.BoxGeometry(BOARD.width + 0.2, BOARD.height + 0.2, 0.08), frameMaterial);
            frame.position.z = -0.03;
            const face = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.width, BOARD.height), material);
            face.position.z = 0.015;
            group.add(frame, face);
            room.add(group);
            this.boards.push(group);
        });
    }

    bind() {
        this.game.network.on('leaderboardState', (data) => {
            this.state = { week: String(data.week ?? ''), boards: data.boards ?? {} };
            this.draw();
        });
    }

    draw() {
        const ctx = this.canvas.getContext('2d');
        const { width, height } = this.canvas;
        ctx.fillStyle = '#16120f';
        ctx.fillRect(0, 0, width, height);
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffb74d';
        ctx.font = 'bold 64px Arial';
        ctx.fillText('🏆 Ranking de la semana', width / 2, 62);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = '26px Arial';
        ctx.fillText(this.state.week ? `Semana ${this.state.week.split('-W')[1]} · se reinicia el lunes` : 'Se reinicia el lunes', width / 2, 112);

        const column = width / LEADERBOARD_CATEGORIES.length;
        LEADERBOARD_CATEGORIES.forEach((category, i) => {
            const x = column * i + column / 2;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 40px Arial';
            ctx.fillText(`${category.icon} ${category.label}`, x, 180);
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '24px Arial';
            ctx.fillText(category.note, x, 220);
            const entries = this.state.boards?.[category.id] ?? [];
            if (entries.length === 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.font = 'italic 28px Arial';
                ctx.fillText('¿Quién será el primero?', x, 330);
            }
            entries.slice(0, 5).forEach((entry, rank) => {
                const y = 285 + rank * 76;
                ctx.fillStyle = ['#ffd54f', '#e0e0e0', '#ffab91', '#bdbdbd', '#bdbdbd'][rank];
                ctx.font = `${rank === 0 ? 'bold ' : ''}32px Arial`;
                const name = String(entry.name ?? '').slice(0, 14);
                ctx.fillText(`${rank + 1}. ${name}`, x, y);
                ctx.fillStyle = 'rgba(255,255,255,0.75)';
                ctx.font = '28px Arial';
                ctx.fillText(category.format(entry.value), x, y + 32);
            });
            if (i > 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.12)';
                ctx.fillRect(column * i, 160, 2, height - 190);
            }
        });
        this.texture.needsUpdate = true;
    }
}
