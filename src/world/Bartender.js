import * as THREE from 'three';
import { RemotePlayer } from '../entities/RemotePlayer';
import { BAR_COUNTER_Z, BACK_BAR_Z } from './RoomLayout';

// The bartender behind each bar's counter: an avatar the game drives (not a
// player: not in `players`, no network). He walks the lane between the
// counter and the back shelf, stops, faces the customers and now and then
// says something. Where he is is a function of the server clock and the
// bar, so everyone sees him in the same place; a drink served in his bar
// gets a "¡Marchando!".
const LANE_Z = (BAR_COUNTER_Z + BACK_BAR_Z) / 2;
const LANE_X = { min: -9, max: 8 };
const SEGMENT = 9000;     // ms: walk somewhere, then wait there
const WALK_SPEED = 1.4;   // units/s
const TALK_CHANCE = 0.35; // per stop
const NAMES = { gamedev: 'Manolo 🍺', desarrollo: 'Paco 🍺' };
const MODELS = { gamedev: 'pj4', desarrollo: 'pj2' };
const LINES = [
    '¿Qué te pongo?',
    'Aquí no se fía.',
    '¿Otra ronda?',
    'Hoy invita la casa… es broma.',
    'Cuidado con el Uber Suicida, que no vuelve nadie igual.',
    '¡Viva el /gamedev/!',
    'Yo también tengo un juego indie a medias, ¿eh?',
    'El de la tragaperras me debe tres cañas.',
    'Si vas a vomitar, al baño, que acabo de fregar.',
    'Arriba en la terraza se ve la fuente, muy bonito todo.'
];
const SERVED = ['¡Marchando!', '¡Marchando una!', 'Aquí tienes, crack.', 'Esa va por la casa… no.'];

// A repeatable pseudo-random number in 0..1 from integers.
function hash(...values) {
    let h = 2166136261;
    values.forEach(value => {
        h ^= value;
        h = Math.imul(h, 16777619);
    });
    return ((h >>> 0) % 100000) / 100000;
}

export class Bartender {
    constructor(game, room) {
        this.game = game;
        this.room = room;
        this.seed = [...room.id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
        this.lastSegment = null;
        this.worldPoint = new THREE.Vector3();
        this.npc = new RemotePlayer(`npc:bartender:${room.id}`, room.toWorld(0, 1, LANE_Z), game);
        this.npc.setModel(MODELS[room.id] ?? 'pj4').then(() => {
            this.npc.setUsername(NAMES[room.id] ?? 'El camarero');
            this.npc.setAppearance({ ...this.npc.appearance, face: 'mustache' });
        });
    }

    bind() {
        // Someone in this bar got a drink.
        this.game.network.on('drinkState', (data) => {
            if (!data?.drink) return;
            const player = this.game.players.players.get(data.userId);
            if (player && this.game.world.getRoomAt(player.position) === this.room) {
                this.say(SERVED[Math.floor(Math.random() * SERVED.length)]);
            }
        });
    }

    say(line) {
        this.npc.showChatBubble(line);
    }

    stopX(segment) {
        return LANE_X.min + hash(this.seed, segment) * (LANE_X.max - LANE_X.min);
    }

    update(deltaTime) {
        const now = this.game.serverClock.now();
        const segment = Math.floor(now / SEGMENT);
        const from = this.stopX(segment - 1);
        const to = this.stopX(segment);
        const elapsed = (now - segment * SEGMENT) / 1000;
        const walkTime = Math.abs(to - from) / WALK_SPEED;
        const walking = elapsed < walkTime;
        const x = walking ? from + (to - from) * (elapsed / walkTime) : to;
        this.npc.targetPosition.copy(this.room.toWorld(x, 1, LANE_Z));
        // Facing his way while walking, then the customers (+z, room-local).
        const localYaw = walking ? (to > from ? Math.PI / 2 : -Math.PI / 2) : 0;
        this.npc.targetRotation = localYaw + this.room.root.rotation.y;
        // Arrived: maybe say something (the same stops for everyone, at
        // slightly different moments is fine).
        if (!walking && this.lastSegment !== segment) {
            this.lastSegment = segment;
            if (hash(this.seed, segment, 7) < TALK_CHANCE) {
                this.say(LINES[Math.floor(hash(this.seed, segment, 11) * LINES.length)]);
            }
        }
        this.npc.update(deltaTime);
    }
}
