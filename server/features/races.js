// Races on the ring road (client: src/world/RaceSync.js).
// Time trial: every lap a driver completes (the client tracks it) arrives as
// raceLap {ms} → best lap on the weekly leaderboard, announced when it's the
// week's record.
// Races: G while driving near the line opens or joins the next race (a 20 s
// lobby); with 2+ cars the lights count down and it's 3 laps. Clients say
// when they finish; the server times it and announces the order, and the
// winner gets a 'races' point. Abandoned after 4 minutes.
const LOBBY_MS = 20000;
const COUNTDOWN_MS = 4000;     // three red lights, then green
const LAPS = 3;
const MIN_LAP_MS = 12000;      // a lap at full nitro takes ~16 s
const MAX_LAP_MS = 5 * 60 * 1000;
const ABANDON_MS = 4 * 60 * 1000;
const RESULTS_MS = 8000;       // the finishers stay on screen a bit
const MAX_ENTRANTS = 9;        // every car

// 63500 → "1:03.5" (as formatLap in the client).
function formatLap(ms) {
    const tenths = Math.round(ms / 100);
    const minutes = Math.floor(tenths / 600);
    const seconds = ((tenths % 600) / 10).toFixed(1).padStart(4, '0');
    return `${minutes}:${seconds}`;
}

function registerRaces(hub) {
    // { phase: 'lobby' | 'running', entrants: Map(id → name), lobbyEndsAt,
    //   startAt (green light), finishes: [{ id, name, ms }], timers }
    let race = null;

    const publicState = () => race
        ? {
            phase: race.phase,
            entrants: [...race.entrants].map(([id, name]) => ({ id, name })),
            lobbyEndsAt: race.lobbyEndsAt,
            startAt: race.startAt ?? null,
            laps: LAPS,
            finishes: race.finishes
        }
        : { phase: 'idle', laps: LAPS };
    const publish = () => hub.broadcastAll({ type: 'raceState', ...publicState() });

    const close = (message) => {
        if (!race) return;
        race.timers.forEach(clearTimeout);
        race = null;
        if (message) hub.announce(message);
        publish();
    };
    const later = (ms, action) => race.timers.push(setTimeout(action, ms));

    const go = () => {
        if (race.entrants.size < 2) {
            close('🏁 Carrera cancelada: hacen falta al menos 2 coches.');
            return;
        }
        race.phase = 'running';
        race.startAt = Date.now() + COUNTDOWN_MS;
        later(COUNTDOWN_MS + ABANDON_MS, () => close('🏁 Carrera abandonada (más de 4 minutos).'));
        hub.announce(`🏁 ¡Salen ${[...race.entrants.values()].join(', ')}! ${LAPS} vueltas.`);
        publish();
    };

    // Everyone still in has finished: show the results a moment, then close.
    const checkDone = () => {
        if (race?.phase !== 'running') return;
        const racing = [...race.entrants.keys()].filter(id => !race.finishes.some(finish => finish.id === id));
        if (racing.length === 0) later(race.finishes.length ? RESULTS_MS : 0, () => close());
    };

    const leave = (userId) => {
        if (!race?.entrants.delete(userId)) return;
        if (race.phase === 'lobby' && race.entrants.size === 0) close('🏁 Carrera cancelada.');
        else {
            checkDone();
            publish();
        }
    };

    hub.on('raceJoin', ({ user }) => {
        if (!user.username || !hub.driving?.carOf(user.id)) return;
        if (race && (race.phase !== 'lobby' || race.entrants.size >= MAX_ENTRANTS)) return;
        if (!race) {
            race = { phase: 'lobby', entrants: new Map(), lobbyEndsAt: Date.now() + LOBBY_MS, finishes: [], timers: [] };
            later(LOBBY_MS, go);
            hub.announce(`🏁 ${user.username} abre una carrera en el circuito: pulsa G conduciendo junto a la meta para apuntarte (20 s).`);
        }
        race.entrants.set(user.id, user.username);
        publish();
    });

    hub.on('raceLeave', ({ user }) => leave(user.id));

    hub.on('raceFinish', ({ user }) => {
        if (race?.phase !== 'running' || !race.entrants.has(user.id)) return;
        if (race.finishes.some(finish => finish.id === user.id)) return;
        // Timed here, not by the client.
        const ms = Date.now() - race.startAt;
        if (ms < LAPS * MIN_LAP_MS) return;
        race.finishes.push({ id: user.id, name: user.username, ms });
        const place = race.finishes.length;
        if (place === 1) {
            hub.leaderboards?.record('races', user.username, 1);
            hub.announce(`🏆 ¡${user.username} gana la carrera! (${formatLap(ms)})`);
        } else {
            hub.announce(`🏁 ${user.username} llega ${place}º (${formatLap(ms)})`);
        }
        checkDone();
        publish();
    });

    hub.on('raceLap', ({ ws, user }, { ms }) => {
        if (!user.username || !hub.driving?.carOf(user.id)) return;
        if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < MIN_LAP_MS || ms > MAX_LAP_MS) return;
        const now = Date.now();
        if (now - (user.lastRaceLap ?? 0) < MIN_LAP_MS) return;
        user.lastRaceLap = now;
        ms = Math.round(ms);
        const record = hub.leaderboards?.best('lap');
        hub.leaderboards?.record('lap', user.username, ms);
        if (!record || ms < record.value) hub.announce(`⏱️ ¡Récord de la semana en el circuito! ${user.username}: ${formatLap(ms)}`);
        hub.send(ws, { type: 'raceLapRecorded', ms, best: hub.leaderboards?.stats(user.username).lap?.value ?? ms });
    });

    hub.onJoin(({ ws }) => hub.send(ws, { type: 'raceState', ...publicState() }));
    hub.onLeave(({ user }) => leave(user.id));
}

module.exports = { registerRaces };
