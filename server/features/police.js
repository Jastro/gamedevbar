// Agente Porras, the plaza's policeman (client: src/world/PoliceSync.js). The
// server walks him so everyone sees the same thing: he patrols round the
// fountain, now and then picks someone in the plaza (drunk people first)
// and chases them shouting; caught, he "searches" them and hands out an
// absurd verdict, announced in the chat. Sprinting (6.5) outruns him (5.2),
// walking (3.7) doesn't. He gives up if they get into a bar or a car, or
// after a while.
const TICK_MS = 200;
// The plaza (as RoomLayout: front walls form a hexagon round it).
const PLAZA_RADIUS = (2 * 15 + 6) / (2 * Math.tan(Math.PI / 6));
const CENTER = { x: 0, z: 10 + PLAZA_RADIUS };
const FOUNTAIN_CLEAR = 3.3;      // the basin is 2.4 across the middle
const PATROL_RADIUS = 12;
const PATROL_SPEED = 1.6;
const CHASE_SPEED = 5.2;
const CATCH_DISTANCE = 1.6;
const ESCAPE_DISTANCE = 4;       // moving this far off mid-search: chase again
const CHASE_MAX_MS = 35000;
const SHOUT_EVERY_MS = 5000;
const SEARCH_STEP_MS = 3200;     // between the search's lines
const PICK_MS = { min: 20000, max: 50000 };
const IDLE_LINE_CHANCE = 0.25;   // per pick that finds nobody
const DRUNK = 1;                 // drinks level (about one beer) that counts as drunk

const LINES = {
    start: [
        '¡Alto! ¡Policía de la Taberna!',
        '¡Quieto ahí, sospechoso de indie!',
        '¡Control rutinario! ¡No corra, que me canso!',
        '¡Eh, tú! ¡Ese andar es de llevar un motor propio sin terminar!',
        '¡Alto en nombre del foro!',
        '¡Usted! ¡Tiene pinta de haber dejado un juego en early access desde 2016!',
        '¡Alto! Ese gorro es sospechoso. Y la cara también.',
        '¡Quieto! Se busca a alguien con su misma pinta de no haber dormido.',
        '¡Inspección sorpresa! ¡Bueno, ya no es sorpresa, pero pare!'
    ],
    drunkStart: [
        '¡Control de alcoholemia! ¡Le huelo desde aquí!',
        '¡Usted ha bebido! Camina en zigzag como mi código.',
        '¡Alto! ¡Ese no es el andar de alguien que ha pedido agua!',
        '¡Usted va más cargado que un servidor en día de lanzamiento!',
        '¡Le veo la nariz roja desde la fuente! ¡Control!'
    ],
    shout: [
        '¡No corra, que es peor!',
        '¡Llevo la porra y no tengo miedo de usarla… para señalar!',
        '¡Uf… uf… pare, que me da algo!',
        '¡Por la autoridad que me confiere el foro!',
        '¡Pararse es gratis, correr le va a salir caro!',
        '¡Que le estoy viendo, eh!',
        '¡Alto o… o… o le escribo un post!',
        '¡Mis rodillas no son de esta generación de consolas!',
        '¡Vuelva aquí, que tengo la multa a medio escribir!',
        '¡Corre como si le persiguiera un publisher!',
        '¡No me haga usar el sprint, que lo tengo sin desbloquear!',
        '¡Ojo, que me sé atajos por detrás de la fuente!',
        '¡Le doy tres segundos! Uno… dos… dos y medio…'
    ],
    caught: [
        '¡Te pillé! Manos donde las vea… no, ahí no.',
        'Documentación, por favor. ¿Cómo que solo lleva un nick?',
        'Control rutinario. Separe las piernas… del teclado.',
        'Bueno, bueno, bueno… ¿qué tenemos aquí?',
        '¡Ajá! ¿Pensaba que no le iba a pillar? Yo tampoco.',
        'Brazos en cruz. Así. Ahora haga el avión. Era para ver si me hacía caso.'
    ],
    drunkCaught: [
        'Sople aquí. Más fuerte. ¡Eso es un eructo, no un soplido!',
        'Siga mi dedo con la mirada. No, el dedo. ¡EL DEDO!'
    ],
    search: [
        'Lleva un mando sin pilas, tres prototipos y un post sin contestar.',
        '¿Y este Kickstarter caducado? Muy sospechoso.',
        'Lleva usted más bugs encima que un hormiguero.',
        '¡Ajá! Un gráfico hecho en Paint. Tendré que confiscarlo por arte.',
        'Un USB con un motor propio… ¡a medias! Eso es delito en tres comunidades.',
        'Lleva en el bolsillo un "ya lo optimizaré luego". Esto es muy grave.',
        '¿Un tutorial de Unity de 2014? Esto es contrabando.',
        'Encuentro un tique de la tragaperras, migas de tortilla y mucha ilusión.',
        'Un cuaderno con 47 ideas de juego y ningún juego. Lo apunto.',
        '¿Esto es un save de hace diez años? Lo requiso por nostalgia.',
        'Una servilleta con un diagrama de clases. Esto es material peligroso.',
        'Lleva usted encima un "TODO: arreglar antes de la demo". De 2019.',
        '¿Un mando con el botón A gastado? Usted ha jugado demasiado al FIFA.',
        'Aquí hay una lista de ideas: "MMO, pero bueno". Muy sospechoso.',
        'Lleva en el bolsillo una moneda de la tragaperras y la dignidad perdida.',
        '¿Esto qué es, un pendrive o un cargamento de memes? Lo requiso para mí.'
    ],
    drunkSearch: [
        'El alcoholímetro marca "game jam". Eso es muy alto.',
        'Da positivo en cañas, chupitos y ganas de bailar.',
        'Según el aparato, usted ahora mismo es un 60% cerveza.',
        'El aparato pita y además me ha pedido una caña.',
        'Sopla usted tan fuerte que me ha despeinado el bigote.'
    ],
    verdict: [
        'Multa: invitar a una ronda al camarero. Circule.',
        'Le dejo ir con una advertencia: comente algo en el foro hoy.',
        'Queda detenido… es broma. Circule, circule.',
        'Multa de tres cañas y un pincho. Se paga en la barra.',
        'Le condeno a hacer un juego en 48 horas. Bueno, váyase.',
        'Todo en orden. Bueno, en orden no, pero me da pereza el papeleo.',
        'Le pongo una multa de un like. Úselo bien.',
        'Por esta vez pase, pero que no le vea yo con Comic Sans.',
        'Le multo con jugar una partida a la tragaperras. Y perder.',
        'Queda libre, pero con la condición de terminar UN juego este año.',
        'Multa: dos horas escuchando las ideas de MMO del camarero.',
        'Le pongo una amonestación. No sé lo que es, pero suena serio.',
        'Puede irse. Y llévese a la fuente, que me mira raro.'
    ],
    escaped: [
        '¡Quieto parado! ¡Que no he terminado!',
        '¡Eh, eh! ¡Que aún no le he mirado los bolsillos!'
    ],
    inBar: [
        'Ha entrado en un bar… territorio del camarero. ¡Ya te pillaré, listillo!',
        '¡Eso no vale, los bares son zona neutral!'
    ],
    inCar: [
        '¡Eh! ¡Coches no! ¡Eso es trampa!',
        '¡Que yo voy a pie! ¡Vuelva aquí!'
    ],
    tired: [
        'Uf… me ahogo… Hoy se libra porque es mi descanso.',
        'Vale, vale, que corra. Ya le multaré en la próxima vida.'
    ],
    idle: [
        'Todo tranquilo en la plaza… demasiado tranquilo.',
        'Esta fuente me mira raro.',
        '¿Quién ha aparcado ese coche ahí? Ah, el Uber Suicida. Mejor no.',
        'Patrullando, que no se diga.',
        'Si alguien ve a un indie sospechoso, que me avise.',
        'Qué bonita está la fuente. Me ha robado el corazón. Y la cartera, creo.',
        'Hoy toca turno de noche. Bueno, de día. Bueno, siempre estoy aquí.',
        'Me han dicho que hay un cartel de Mediavida que gira. Lo tengo vigilado.',
        'Silbato nuevo, porra nueva, mismas ganas de dormir.',
        'Si alguien se sube a la fuente, le pongo una multa de diez gotas.'
    ]
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

function registerPolice(hub) {
    const cop = {
        x: CENTER.x, z: CENTER.z - PATROL_RADIUS, yaw: 0,
        phase: 'patrol', targetId: null,
        patrolAngle: 0, nextPickAt: Date.now() + PICK_MS.min,
        chaseStartedAt: 0, lastShoutAt: 0, searchStep: 0, searchAt: 0
    };

    const publicState = () => ({ x: round(cop.x), z: round(cop.z), yaw: round(cop.yaw), phase: cop.phase, targetId: cop.targetId });
    // targetId: who it's aimed at (they get it in their chat too); final:
    // the verdict, which the chat announcement already shows.
    const say = (line, final = false) => hub.broadcastAll({ type: 'policeSay', line, targetId: cop.targetId, final });

    const users = () => [...hub.users.values()].filter(user => user.username && Array.isArray(user.position));
    const fromCenter = (x, z) => Math.hypot(x - CENTER.x, z - CENTER.z);
    // In the open plaza (not in a bar, a road or the fountain).
    const inPlaza = (user) => {
        const distance = fromCenter(user.position[0], user.position[2]);
        return distance < PLAZA_RADIUS - 0.5 && distance > FOUNTAIN_CLEAR - 0.5;
    };
    const driving = (user) => Boolean(hub.driving?.carOf(user.id));
    const drunk = (user) => (hub.drinks?.levelOf(user) ?? 0) > DRUNK;

    const backToPatrol = (line) => {
        if (line) say(line);
        cop.phase = 'patrol';
        cop.targetId = null;
        cop.patrolAngle = Math.atan2(-(cop.x - CENTER.x), -(cop.z - CENTER.z));
        cop.nextPickAt = Date.now() + PICK_MS.min + Math.random() * (PICK_MS.max - PICK_MS.min);
    };

    // Toward (x, z) at `speed`, round the fountain rather than through it.
    const walkTo = (x, z, speed, dt) => {
        const dx = x - cop.x;
        const dz = z - cop.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 0.01) return distance;
        const step = Math.min(distance, speed * dt);
        cop.x += (dx / distance) * step;
        cop.z += (dz / distance) * step;
        cop.yaw = Math.atan2(dx, dz);
        const out = fromCenter(cop.x, cop.z);
        if (out < FOUNTAIN_CLEAR) {
            const scale = FOUNTAIN_CLEAR / Math.max(out, 0.01);
            cop.x = CENTER.x + (cop.x - CENTER.x) * scale;
            cop.z = CENTER.z + (cop.z - CENTER.z) * scale;
        }
        return distance - step;
    };

    const tick = () => {
        const now = Date.now();
        const dt = TICK_MS / 1000;
        const everyone = users();
        if (everyone.length === 0) return;

        if (cop.phase === 'patrol') {
            cop.patrolAngle += (PATROL_SPEED / PATROL_RADIUS) * dt;
            walkTo(CENTER.x - Math.sin(cop.patrolAngle) * PATROL_RADIUS, CENTER.z - Math.cos(cop.patrolAngle) * PATROL_RADIUS, PATROL_SPEED, dt);
            if (now >= cop.nextPickAt) {
                const candidates = everyone.filter(user => inPlaza(user) && !driving(user));
                // Drunk people count three times.
                const weighted = candidates.flatMap(user => (drunk(user) ? [user, user, user] : [user]));
                if (weighted.length === 0) {
                    if (Math.random() < IDLE_LINE_CHANCE) say(pick(LINES.idle));
                    cop.nextPickAt = now + PICK_MS.min;
                } else {
                    const target = pick(weighted);
                    cop.phase = 'chase';
                    cop.targetId = target.id;
                    cop.chaseStartedAt = now;
                    cop.lastShoutAt = now;
                    say(pick(drunk(target) ? LINES.drunkStart : LINES.start));
                }
            }
        } else {
            const target = hub.findUser(cop.targetId)?.user;
            if (!target || !Array.isArray(target.position)) return backToPatrol(null);
            if (driving(target)) return backToPatrol(pick(LINES.inCar));
            if (!inPlaza(target)) return backToPatrol(pick(LINES.inBar));
            const [x, , z] = target.position;
            if (cop.phase === 'chase') {
                if (now - cop.chaseStartedAt > CHASE_MAX_MS) return backToPatrol(pick(LINES.tired));
                const left = walkTo(x, z, CHASE_SPEED, dt);
                if (left < CATCH_DISTANCE) {
                    cop.phase = 'search';
                    cop.searchStep = 0;
                    cop.searchAt = now;
                    cop.drunkTarget = drunk(target);
                    say(pick(cop.drunkTarget ? LINES.drunkCaught : LINES.caught));
                } else if (now - cop.lastShoutAt > SHOUT_EVERY_MS) {
                    cop.lastShoutAt = now;
                    say(pick(LINES.shout));
                }
            } else if (cop.phase === 'search') {
                cop.yaw = Math.atan2(x - cop.x, z - cop.z);
                if (Math.hypot(x - cop.x, z - cop.z) > ESCAPE_DISTANCE) {
                    cop.phase = 'chase';
                    cop.lastShoutAt = now;
                    say(pick(LINES.escaped));
                } else if (now - cop.searchAt > SEARCH_STEP_MS) {
                    cop.searchAt = now;
                    cop.searchStep++;
                    if (cop.searchStep === 1) {
                        say(pick(cop.drunkTarget ? LINES.drunkSearch : LINES.search));
                    } else {
                        const verdict = pick(LINES.verdict);
                        say(verdict, true);
                        hub.announce?.(`🚓 El Agente Porras ha cacheado a ${target.username}. ${verdict}`);
                        backToPatrol(null);
                    }
                }
            }
        }
        hub.broadcastAll({ type: 'policeState', ...publicState() });
    };
    setInterval(tick, TICK_MS);

    hub.onJoin(({ ws }) => hub.send(ws, { type: 'policeState', ...publicState() }));
}

function round(value) {
    return Math.round(value * 100) / 100;
}

module.exports = { registerPolice };
