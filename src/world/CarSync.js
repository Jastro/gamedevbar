import * as THREE from 'three';
import { PLAZA_CENTER, PLAZA_RADIUS } from './RoomLayout';

// The plaza car's shared seats (server: server/features/car.js).
// - `carSit {slot}` asks for a seat; `carState` says who sits where, any
//   countdown, and whether a ride is on (we sit down once it lists us).
// - `carSmoke {occupants}`: smoke and hiss for everyone; passengers fade to
//   black, each lands somewhere random in the map, and fades back in.
const SMOKE_TO_FADE = 3000; // ms from the smoke starting to the fade out
const FADE_TO_TELEPORT = 1000; // ms (the fade's CSS transition is 0.9 s)
const TELEPORT_TO_FADE_IN = 300;
const SPOT_TRIES = 60;
// Room-local area where a passenger may land inside a bar (in front of the
// bar counter, away from the walls), and outside: anywhere on the plaza.
const ROOM_AREA = { minX: -12, maxX: 12, minZ: -0.5, maxZ: 8.5 };
const PLAZA_LANDING_RADIUS = PLAZA_RADIUS - 2;
const CAR_CLEARANCE = 3.5;
const PLAYER_RADIUS = 0.4;

export class CarSync {
    constructor(game) {
        this.game = game;
        this.slots = new Array(5).fill(null);
        this.countdownEndsAt = null;
        this.riding = false;
        this.teleporting = false;
        this.createOverlays();
    }

    get car() {
        return this.game.environment.car;
    }

    get localId() {
        return this.game.players.localPlayer?.id;
    }

    createOverlays() {
        this.fade = document.createElement('div');
        this.fade.id = 'fade-overlay';
        document.body.appendChild(this.fade);
        this.countdown = document.createElement('div');
        this.countdown.id = 'car-countdown';
        this.countdown.className = 'hidden';
        document.body.appendChild(this.countdown);
    }

    bind() {
        const { network } = this.game;
        network.on('carState', (data) => this.applyState(data));
        network.on('carDenied', (data) => {
            const message = {
                riding: '🚗 Ahora no, que ya van de viaje.',
                full: '🚗 El coche está lleno.'
            }[data.reason] ?? '🚗 Ese sitio ya está ocupado.';
            this.game.ui.chat?.addMessage({ type: 'system', message });
        });
        network.on('carSmoke', (data) => this.startRide(Array.isArray(data.occupants) ? data.occupants : []));
        // Standing up from a car seat (WASD) gives it back, except when the
        // ride itself stands us up somewhere else.
        this.car.seats.forEach(seat => {
            seat.userData.onStand = () => {
                if (this.teleporting) return;
                // Until a carState without us arrives, ignore older ones
                // that still list us (they'd sit us back down).
                this.leaving = true;
                this.game.network.send('carLeave', {});
            };
        });
    }

    get freeSlots() {
        return this.slots.filter(slot => !slot).length;
    }

    // Click / F on the car: ask for the first free seat.
    enter() {
        const player = this.game.players.localPlayer;
        if (!player || this.teleporting) return;
        if (this.riding) {
            this.game.ui.chat?.addMessage({ type: 'system', message: '🚗 Ahora no, que ya van de viaje.' });
            return;
        }
        if (this.slots.includes(player.id)) return;
        const slot = this.slots.findIndex(id => !id);
        if (slot === -1) {
            this.game.ui.chat?.addMessage({ type: 'system', message: '🚗 El coche está lleno.' });
            return;
        }
        this.leaving = false;
        if (this.game.network.isConnected) {
            // The server picks the seat (two people may click at once).
            this.game.network.send('carSit', {});
        } else {
            this.sitIn(slot);
        }
    }

    sitIn(slot) {
        const player = this.game.players.localPlayer;
        const seat = this.car.getSeat(slot);
        if (!player || !seat || player.seat === seat) return;
        if (player.isSitting) player.standUp();
        player.sitDown(seat);
    }

    applyState({ slots, countdownEndsAt, riding }) {
        if (Array.isArray(slots)) this.slots = slots;
        this.countdownEndsAt = countdownEndsAt ?? null;
        this.riding = Boolean(riding);
        const player = this.game.players.localPlayer;
        if (!player || this.teleporting) return;

        const mySlot = this.slots.indexOf(player.id);
        const inCar = this.car.seats.includes(player.seat);
        if (mySlot === -1) this.leaving = false;
        if (mySlot !== -1 && this.leaving) {
            // Stale: we already got out.
        } else if (mySlot !== -1) {
            this.sitIn(mySlot);
        } else if (inCar) {
            // The server freed our seat (e.g. it reset): get out.
            player.standUp();
        }
        this.updateCountdown();
    }

    // "🚗💨 3" for the passengers while the countdown runs.
    updateCountdown() {
        clearInterval(this.countdownTimer);
        const passenger = this.slots.includes(this.localId);
        if (!this.countdownEndsAt || !passenger) {
            this.countdown.classList.add('hidden');
            return;
        }
        const tick = () => {
            const left = Math.ceil((this.countdownEndsAt - this.game.serverClock.now()) / 1000);
            if (left <= 0) {
                clearInterval(this.countdownTimer);
                this.countdown.classList.add('hidden');
                return;
            }
            this.countdown.textContent = `🚗💨 ${left}`;
            this.countdown.classList.remove('hidden');
        };
        tick();
        this.countdownTimer = setInterval(tick, 200);
    }

    startRide(occupants) {
        clearInterval(this.countdownTimer);
        this.countdown.classList.add('hidden');
        this.car.playSmoke(this.game.environment.audioListener);

        const player = this.game.players.localPlayer;
        if (!player || !occupants.includes(player.id)) return;
        this.teleporting = true;
        setTimeout(() => this.fade.classList.add('visible'), SMOKE_TO_FADE);
        setTimeout(() => {
            const spot = this.findRandomSpot();
            if (player.isSitting) {
                player.standUp(spot);
            } else {
                player.position.copy(spot);
            }
            player.rotation = Math.random() * Math.PI * 2;
            this.game.camera.reset();
            setTimeout(() => {
                this.fade.classList.remove('visible');
                this.teleporting = false;
                this.game.ui.chat?.addMessage({ type: 'system', message: '💨 ¿Dónde estoy?' });
            }, TELEPORT_TO_FADE_IN);
        }, SMOKE_TO_FADE + FADE_TO_TELEPORT);
    }

    // A random free spot inside one of the bars or on the plaza.
    findRandomSpot() {
        const { world } = this.game;
        const rooms = [...world.rooms.values()];
        const carCenter = this.car.getCenter();
        for (let i = 0; i < SPOT_TRIES; i++) {
            const area = Math.floor(Math.random() * (rooms.length + 1));
            const room = rooms[area] ?? null;
            let spot;
            if (room) {
                spot = room.toWorld(randomIn(ROOM_AREA.minX, ROOM_AREA.maxX), 1, randomIn(ROOM_AREA.minZ, ROOM_AREA.maxZ));
            } else {
                // Uniform over the plaza's disc.
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.sqrt(Math.random()) * PLAZA_LANDING_RADIUS;
            spot = new THREE.Vector3(PLAZA_CENTER.x + Math.sin(angle) * distance, 1, PLAZA_CENTER.z + Math.cos(angle) * distance);
                if (Math.hypot(spot.x - carCenter.x, spot.z - carCenter.z) < CAR_CLEARANCE) continue;
            }
            if (world.getRoomAt(spot) !== room) continue;
            // Not inside a bathroom (it may be latched).
            if (this.game.environment.getBathroomAt(spot)) continue;
            if (world.checkCollision(spot, PLAYER_RADIUS)) continue;
            return spot;
        }
        // Nothing free found (unlikely): the first bar's middle.
        return rooms[0].toWorld(0, 1, 0);
    }
}

function randomIn(min, max) {
    return min + Math.random() * (max - min);
}
