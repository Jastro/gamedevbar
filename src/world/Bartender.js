import * as THREE from 'three';
import { RemotePlayer } from '../entities/RemotePlayer';
import { BAR_COUNTER_Z, BACK_BAR_Z } from './RoomLayout';

// The bartender behind each bar's counter: an avatar the game drives (not a
// player: not in `players`, no network). He walks the lane between the
// counter and the back shelf, stops, faces the customers and now and then
// says something. Where he is is a function of the server clock and the
// bar, so everyone sees him in the same place; a drink served in his bar
// gets a "¡Marchando!".
// He stands on a raised deck behind the counter (the counter is 1.3 high and
// the avatars are short), filling the gap between counter (x -6..6, 2 deep)
// and back shelf (0.5 deep); players can jump up onto it too.
const DECK = { halfWidth: 6, minZ: BACK_BAR_Z + 0.25, maxZ: BAR_COUNTER_Z - 1, height: 0.5 };
const LANE_Z = (DECK.minZ + DECK.maxZ) / 2;
const LANE_X = { min: -5.3, max: 5.3 };
const SEGMENT = 9000;     // ms: walk somewhere, then wait there
const WALK_SPEED = 1.4;   // units/s
const TALK_CHANCE = 0.35; // per stop
// Bigger than any player (their size slider stops at 1.15), so he shows well
// over the counter; his center goes up with it, feet on the deck.
const SCALE = 1.35;
const CENTER_Y = DECK.height + SCALE;
const NAMES = { gamedev: 'Manolo 🍺', desarrollo: 'Paco 🍺', feda: 'Fermín 🍺', offtopic: 'Lola 🍺' };
const MODELS = { gamedev: 'pj4', desarrollo: 'pj2', feda: 'pj3', offtopic: 'pj5' };
// Any bar's. Sarcastic on purpose.
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
    'Arriba en la terraza se ve la fuente, muy bonito todo.',
    '¿Otra caña o vas a seguir mirando la barra como si te debiera dinero?',
    'Tu juego sale "en dos semanas" desde 2019, ¿no?',
    'Aquí el único que termina proyectos es el lavavajillas.',
    'Si me pides agua te cobro el vaso, la sed y el disgusto.',
    'Llevo 20 años detrás de esta barra y todavía no he visto a nadie terminar un MMO.',
    'Se aceptan Bizum, efectivo y promesas de early access.',
    'El wifi es "pagaprimero", todo junto y en minúsculas.',
    'He visto más bugs en vuestro código que cucarachas en la cocina. Y eso es mucho decir.',
    'No, no te voy a poner la caña en el motor propio. Usa un vaso como todo el mundo.',
    'El último que dijo "esto lo arreglo en un finde" sigue en el baño.',
    'Hoy tenemos de tapa: crunch con patatas.',
    'Si vienes a llorar por Unity, la barra libre de pañuelos se acabó ayer.',
    '¿Godot, Unreal o Unity? Me da igual, la caña cuesta lo mismo.',
    'Ese que ves en la tragaperras se jugó el presupuesto de su Kickstarter.',
    'A las tres de la mañana aquí todo el mundo es diseñador de juegos.',
    'Yo de joven también quería hacer un RPG. Ahora sirvo cañas. Haz cuentas.',
    'Vuestra hoja de ruta tiene menos sentido que la carta de vinos.',
    'Los pájaros de fuera son de verdad. El resto del bar, lo dudo.',
    'He pedido a los mods que te baneen de la barra. Me han dicho que con +1 no vale.',
    'Mi sueño es un sábado sin que nadie me hable de shaders.',
    'Si la fuente echara cerveza, yo estaría en el paro y feliz.',
    'Este bar no tiene mecánicas de crafteo: pides, pagas, bebes.',
    'Hay un tío arriba en la terraza que lleva tres días diciendo "ahora bajo".',
    'Aquí el único balance que importa es el de mi caja.',
    'No me mires así, que yo también tengo un Steam lleno de juegos sin abrir.',
    'Me han dicho que el bar entero es un prototipo. Ya decía yo que crujía.',
    'He visto el fin del mundo tres veces. Las tres en una game jam.',
    'Si oyes risas en el baño, mejor no preguntes.',
    'El cliente siempre tiene razón. Tú no eres cliente, tú eres habitual.',
    'Por cada "pole" que oigo me tomo un chupito. Voy por el cuarenta.'
];
// One bar's own, mixed in with the rest.
const ROOM_LINES = {
    gamedev: [
        'Aquí se viene a hablar de juegos, no a hacerlos.',
        'Otro que va a revolucionar el género. Apúntalo en la pizarra con los otros 200.'
    ],
    desarrollo: [
        'Aquí se discute de tabuladores contra espacios hasta que cerramos.',
        'Mi código no tiene bugs, tiene características sorpresa.'
    ],
    feda: [
        'Aquí se discute de todo y no se arregla nada. Como en casa.',
        'Prohibido hablar de política… es broma, aquí no se habla de otra cosa.',
        'Ese de la esquina lleva desde las ocho dando la razón a nadie.',
        'Si vienes con un titular sin leer la noticia, la caña te la cobro doble.'
    ],
    offtopic: [
        'Aquí ni yo sé de qué estamos hablando.',
        'Ayer alguien pidió un café con hielo y una opinión sobre los gatos. Le serví las dos.',
        'En Offtopic el tema del día es "sí".',
        'Si encuentras el sentido de este bar, devuélvemelo, que lo perdí en 2009.'
    ]
};
const SERVED = [
    '¡Marchando!', '¡Marchando una!', 'Aquí tienes, crack.', 'Esa va por la casa… no.',
    'Toma, y no la tires encima del futbolín.', 'Bebe despacio, que el baño está ocupado.',
    'Ahí la tienes, con su espuma y su desprecio.', 'Disfrútala, es lo único que vas a terminar hoy.'
];

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
        // The bar's own lines twice: they come up more than any one general line.
        const own = ROOM_LINES[room.id] ?? [];
        this.lines = [...LINES, ...own, ...own];
        this.worldPoint = new THREE.Vector3();
        this.createDeck();
        this.npc = new RemotePlayer(`npc:bartender:${room.id}`, room.toWorld(0, CENTER_Y, LANE_Z), game);
        this.npc.mesh.scale.setScalar(SCALE);
        this.npc.setModel(MODELS[room.id] ?? 'pj4').then(() => {
            this.npc.setUsername(NAMES[room.id] ?? 'El camarero');
            this.npc.setAppearance({ ...this.npc.appearance, face: 'mustache' });
        });
    }

    createDeck() {
        const { halfWidth, minZ, maxZ, height } = DECK;
        const deck = new THREE.Mesh(
            new THREE.BoxGeometry(halfWidth * 2, height, maxZ - minZ),
            new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.85 })
        );
        deck.position.set(0, height / 2, (minZ + maxZ) / 2);
        deck.receiveShadow = true;
        this.room.add(deck);
        deck.updateMatrixWorld(true);
        this.game.world.collisionManager.addBoxPlatform(deck);
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
        this.npc.targetPosition.copy(this.room.toWorld(x, CENTER_Y, LANE_Z));
        // Facing his way while walking, then the customers (+z, room-local).
        const localYaw = walking ? (to > from ? Math.PI / 2 : -Math.PI / 2) : 0;
        this.npc.targetRotation = localYaw + this.room.root.rotation.y;
        // Arrived: maybe say something (the same stops for everyone, at
        // slightly different moments is fine).
        if (!walking && this.lastSegment !== segment) {
            this.lastSegment = segment;
            if (hash(this.seed, segment, 7) < TALK_CHANCE) {
                this.say(this.lines[Math.floor(hash(this.seed, segment, 11) * this.lines.length)]);
            }
        }
        this.npc.update(deltaTime);
        this.updateVisibility();
    }

    // Only while you can see him: in his bar, or through its open door. His
    // name and speech bubbles ignore walls (drawn on top), so otherwise every
    // bartender's showed through every wall.
    updateVisibility() {
        const player = this.game.players.localPlayer;
        const contents = this.game.environment.rooms.get(this.room.id);
        const inHisBar = Boolean(player) && this.game.world.getRoomAt(player.position) === this.room;
        const throughDoor = Boolean(contents?.interior.visible) && contents.door.angle !== 0;
        this.npc.mesh.visible = inHisBar || throughDoor;
    }
}
