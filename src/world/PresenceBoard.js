import * as THREE from 'three';

const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 900;
const REFRESH_INTERVAL = 500; // ms between checks; redraws only on change
const MAX_NAMES = 18;         // two columns of 9

// "Who's here" board on the front wall (where the forum TV used to be): the
// players currently inside this room, 🎙️ while they talk, plus how many are
// in the other rooms and on the street. Built from the positions every
// client already knows, so it needs no server state.
export class PresenceBoard {
    constructor(room) {
        this.room = room;
        this.lastCheck = 0;
        this.signature = null;
    }

    create() {
        this.group = new THREE.Group();
        this.group.name = 'PresenceBoard';
        this.group.position.set(7, 3.8, 9.9);
        this.group.rotation.y = Math.PI; // face into the room

        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(6.5, 4, 0.2),
            new THREE.MeshStandardMaterial({ color: 0x2f2f2f, roughness: 0.5, metalness: 0.7 })
        );
        this.group.add(frame);

        this.canvas = document.createElement('canvas');
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
        this.context = this.canvas.getContext('2d');
        this.texture = new THREE.CanvasTexture(this.canvas);
        const screen = new THREE.Mesh(
            new THREE.PlaneGeometry(6.3, 3.8),
            new THREE.MeshBasicMaterial({ map: this.texture })
        );
        screen.position.z = 0.11;
        this.group.add(screen);

        this.room.add(this.group);
        this.draw({ here: [], elsewhere: [] });
    }

    // game: for players (positions/names), world (rooms) and voice (talking).
    update(game) {
        const now = performance.now();
        if (now - this.lastCheck < REFRESH_INTERVAL) return;
        this.lastCheck = now;

        const { world, players } = game;
        const here = [];
        const counts = new Map(); // room name or 'la calle' -> count
        players.players.forEach(player => {
            if (!player.mesh) return;
            const isLocal = player === players.localPlayer;
            const name = (isLocal ? game.username : player.username) || '…';
            const talking = isLocal ? game.voice?.isTalking : player.talkSprite?.visible;
            const room = world.getRoomAt(player.position);
            if (room === this.room) {
                here.push({ name, talking: Boolean(talking), isLocal });
            } else {
                const place = room ? room.name : 'la calle';
                counts.set(place, (counts.get(place) ?? 0) + 1);
            }
        });
        here.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        const elsewhere = [...counts].map(([place, count]) => ({ place, count }));

        const signature = JSON.stringify([here, elsewhere]);
        if (signature === this.signature) return;
        this.signature = signature;
        this.draw({ here, elsewhere });
    }

    draw({ here, elsewhere }) {
        const ctx = this.context;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Header, in the old forum TV's orange.
        const header = ctx.createLinearGradient(0, 0, 0, 110);
        header.addColorStop(0, '#ff7f40');
        header.addColorStop(0.5, '#ff9644');
        header.addColorStop(1, '#ff7f40');
        ctx.fillStyle = header;
        ctx.fillRect(0, 0, CANVAS_WIDTH, 110);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 64px Arial';
        ctx.fillText(`🍺 En ${this.room.name} ahora · ${here.length}`, CANVAS_WIDTH / 2, 58);

        ctx.textAlign = 'left';
        if (here.length === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = 'italic 48px Arial';
            ctx.fillText('No hay nadie… ¡entra y saluda!', 80, 300);
        }
        here.slice(0, MAX_NAMES).forEach((person, index) => {
            const column = index < MAX_NAMES / 2 ? 0 : 1;
            const row = index % (MAX_NAMES / 2);
            const x = 80 + column * 760;
            const y = 175 + row * 68;
            ctx.fillStyle = person.talking ? '#ffb347' : '#ffffff';
            ctx.font = `${person.isLocal ? 'bold ' : ''}46px Arial`;
            const label = `${person.talking ? '🎙️' : '•'} ${person.name}${person.isLocal ? ' (tú)' : ''}`;
            ctx.fillText(label, x, y, 700);
        });
        if (here.length > MAX_NAMES) {
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = '40px Arial';
            ctx.fillText(`y ${here.length - MAX_NAMES} más…`, 840, 175 + 8 * 68);
        }

        // Footer: everyone else.
        ctx.fillStyle = '#262626';
        ctx.fillRect(0, CANVAS_HEIGHT - 100, CANVAS_WIDTH, 100);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = '40px Arial';
        ctx.textAlign = 'center';
        const footer = elsewhere.length
            ? elsewhere.map(({ place, count }) => `${place}: ${count}`).join('   ·   ')
            : 'Nadie más conectado';
        ctx.fillText(footer, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 50);

        this.texture.needsUpdate = true;
    }
}
