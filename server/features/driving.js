// Drivable cars on the plaza and ring road (src/world/DrivingSync.js). One
// driver per car: the driver's client drives it and sends its pose 20 times
// a second; the server keeps the last one (so a car stays where it was left)
// and relays it. Cars nobody has moved yet sit at the client's parking spots.
// 'uber' is the Uber Suicida (the smoke car): its driver's seat drives it.
// The open-top cars also take one passenger (`driveRide`, only while someone
// drives it); the passenger stays in when the driver gets out.
const CAR_IDS = ['car1', 'car2', 'car3', 'car4', 'car5', 'car6', 'car7', 'car8', 'uber'];
const MIN_UPDATE_MS = 30;
const WORLD_LIMIT = 200; // |x|, |z|: far past the map's wall
const MAX_PUSH = 1.5; // how far one push message may move a car
const MAX_KICK = 20;  // the speed a push may give a driven car

const finite = (value, limit) => (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit ? value : null);

function registerDriving(hub) {
    const cars = new Map(); // carId -> { driver, name, passenger, passengerName, x, z, yaw, speed, steer }

    const publicState = (carId) => ({ carId, ...cars.get(carId) });
    const publish = (carId) => hub.broadcastAll({ type: 'driveState', ...publicState(carId) });
    const carOf = (user) => [...cars.entries()].find(([, car]) => car.driver === user.id)?.[0] ?? null;
    const rideOf = (user) => [...cars.entries()].find(([, car]) => car.passenger === user.id)?.[0] ?? null;

    const release = (carId) => {
        const car = cars.get(carId);
        if (!car?.driver) return;
        car.driver = null;
        car.name = null;
        car.speed = 0;
        publish(carId);
    };

    const releaseRide = (carId) => {
        const car = cars.get(carId);
        if (!car?.passenger) return;
        car.passenger = null;
        car.passengerName = null;
        publish(carId);
    };

    hub.on('driveStart', ({ ws, user }, { carId, x, z, yaw }) => {
        if (!user.username || !CAR_IDS.includes(carId) || carOf(user) || rideOf(user)) return;
        const car = cars.get(carId) ?? {};
        if (car.driver && hub.findUser(car.driver)) {
            hub.send(ws, { type: 'driveBusy', carId, name: car.name });
            return;
        }
        // A car nobody moved yet starts from where the client parked it.
        const start = car.x === undefined
            ? { x: finite(x, WORLD_LIMIT) ?? 0, z: finite(z, WORLD_LIMIT) ?? 0, yaw: finite(yaw, 100) ?? 0 }
            : { x: car.x, z: car.z, yaw: car.yaw };
        cars.set(carId, { ...car, ...start, speed: 0, steer: 0, driver: user.id, name: user.username });
        publish(carId);
    });

    // The passenger's seat of a car someone is driving.
    hub.on('driveRide', ({ ws, user }, { carId }) => {
        if (!user.username || !CAR_IDS.includes(carId) || carId === 'uber' || carOf(user) || rideOf(user)) return;
        const car = cars.get(carId);
        if (!car?.driver || !hub.findUser(car.driver)) return;
        if (car.passenger && hub.findUser(car.passenger)) {
            hub.send(ws, { type: 'driveBusy', carId, name: car.passengerName, seat: 'passenger' });
            return;
        }
        car.passenger = user.id;
        car.passengerName = user.username;
        publish(carId);
    });

    hub.on('driveUpdate', ({ ws, user }, { carId, x, z, yaw, speed, steer, nitro }) => {
        const car = cars.get(carId);
        if (!car || car.driver !== user.id) return;
        const now = Date.now();
        if (now - (user.lastDriveUpdate ?? 0) < MIN_UPDATE_MS) return;
        user.lastDriveUpdate = now;
        const pose = { x: finite(x, WORLD_LIMIT), z: finite(z, WORLD_LIMIT), yaw: finite(yaw, 1000) };
        if (pose.x === null || pose.z === null || pose.yaw === null) return;
        Object.assign(car, pose, {
            speed: Math.max(-30, Math.min(30, finite(speed, 100) ?? 0)),
            steer: Math.max(-1, Math.min(1, finite(steer, 10) ?? 0))
        });
        // nitro: Shift held (flames and a roar for everyone); not kept.
        hub.broadcast({ type: 'driveUpdate', carId, x: car.x, z: car.z, yaw: car.yaw, speed: car.speed, steer: car.steer, nitro: Boolean(nitro) }, ws);
    });

    // A car shoved by another one. Parked: the pusher's client slides it (x,
    // z, yaw: where it is now, a short way from where it was; it may keep
    // sliding after the pusher got out) and everyone else follows. Driven:
    // its own driver moves it (the shove dx, dz and the kick vx, vz relayed).
    hub.on('drivePush', ({ ws, user }, { carId, x, z, yaw, dx, dz, vx, vz }) => {
        if (!user.username || !CAR_IDS.includes(carId) || carOf(user) === carId) return;
        const now = Date.now();
        user.lastDrivePush ??= {};
        if (now - (user.lastDrivePush[carId] ?? 0) < MIN_UPDATE_MS) return;
        user.lastDrivePush[carId] = now;
        const car = cars.get(carId) ?? {};
        const driver = car.driver ? hub.findUser(car.driver) : null;
        if (driver) {
            const shove = {
                dx: finite(dx, MAX_PUSH), dz: finite(dz, MAX_PUSH),
                vx: finite(vx, MAX_KICK) ?? 0, vz: finite(vz, MAX_KICK) ?? 0
            };
            if (shove.dx === null || shove.dz === null) return;
            hub.send(driver.ws, { type: 'drivePushed', carId, ...shove });
            return;
        }
        const pose = { x: finite(x, WORLD_LIMIT), z: finite(z, WORLD_LIMIT), yaw: finite(yaw, 1000) };
        if (pose.x === null || pose.z === null || pose.yaw === null) return;
        if (car.x !== undefined && Math.hypot(pose.x - car.x, pose.z - car.z) > MAX_PUSH) return;
        cars.set(carId, { ...car, ...pose, speed: 0, steer: 0, driver: null, name: null });
        hub.broadcast({ type: 'driveUpdate', carId, ...pose, speed: 0, steer: 0 }, ws);
    });

    // Out of whichever seat you're in.
    hub.on('driveStop', ({ user }) => {
        const carId = carOf(user);
        if (carId) release(carId);
        const rideId = rideOf(user);
        if (rideId) releaseRide(rideId);
    });

    hub.onJoin(({ ws }) => {
        hub.send(ws, { type: 'driveStates', cars: [...cars.keys()].map(publicState) });
    });

    hub.onLeave(({ user }) => {
        const carId = carOf(user);
        if (carId) release(carId);
        const rideId = rideOf(user);
        if (rideId) releaseRide(rideId);
    });
}

module.exports = { registerDriving, CAR_IDS };
