// Drivable cars on the plaza and ring road (src/world/DrivingSync.js). One
// driver per car: the driver's client drives it and sends its pose 20 times
// a second; the server keeps the last one (so a car stays where it was left)
// and relays it. Cars nobody has moved yet sit at the client's parking spots.
// 'uber' is the Uber Suicida (the smoke car): its driver's seat drives it.
const CAR_IDS = ['car1', 'car2', 'car3', 'car4', 'uber'];
const MIN_UPDATE_MS = 30;
const WORLD_LIMIT = 200; // |x|, |z|: far past the map's wall

const finite = (value, limit) => (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit ? value : null);

function registerDriving(hub) {
    const cars = new Map(); // carId -> { driver, name, x, z, yaw, speed, steer }

    const publicState = (carId) => ({ carId, ...cars.get(carId) });
    const publish = (carId) => hub.broadcastAll({ type: 'driveState', ...publicState(carId) });
    const carOf = (user) => [...cars.entries()].find(([, car]) => car.driver === user.id)?.[0] ?? null;

    const release = (carId) => {
        const car = cars.get(carId);
        if (!car?.driver) return;
        car.driver = null;
        car.name = null;
        car.speed = 0;
        publish(carId);
    };

    hub.on('driveStart', ({ ws, user }, { carId, x, z, yaw }) => {
        if (!user.username || !CAR_IDS.includes(carId) || carOf(user)) return;
        const car = cars.get(carId) ?? {};
        if (car.driver && hub.findUser(car.driver)) {
            hub.send(ws, { type: 'driveBusy', carId, name: car.name });
            return;
        }
        // A car nobody moved yet starts from where the client parked it.
        const start = car.x === undefined
            ? { x: finite(x, WORLD_LIMIT) ?? 0, z: finite(z, WORLD_LIMIT) ?? 0, yaw: finite(yaw, 100) ?? 0 }
            : { x: car.x, z: car.z, yaw: car.yaw };
        cars.set(carId, { ...start, speed: 0, steer: 0, driver: user.id, name: user.username });
        publish(carId);
    });

    hub.on('driveUpdate', ({ ws, user }, { carId, x, z, yaw, speed, steer }) => {
        const car = cars.get(carId);
        if (!car || car.driver !== user.id) return;
        const now = Date.now();
        if (now - (user.lastDriveUpdate ?? 0) < MIN_UPDATE_MS) return;
        user.lastDriveUpdate = now;
        const pose = { x: finite(x, WORLD_LIMIT), z: finite(z, WORLD_LIMIT), yaw: finite(yaw, 1000) };
        if (pose.x === null || pose.z === null || pose.yaw === null) return;
        Object.assign(car, pose, {
            speed: Math.max(-20, Math.min(20, finite(speed, 100) ?? 0)),
            steer: Math.max(-1, Math.min(1, finite(steer, 10) ?? 0))
        });
        hub.broadcast({ type: 'driveUpdate', carId, x: car.x, z: car.z, yaw: car.yaw, speed: car.speed, steer: car.steer }, ws);
    });

    hub.on('driveStop', ({ user }) => {
        const carId = carOf(user);
        if (carId) release(carId);
    });

    hub.onJoin(({ ws }) => {
        hub.send(ws, { type: 'driveStates', cars: [...cars.keys()].map(publicState) });
    });

    hub.onLeave(({ user }) => {
        const carId = carOf(user);
        if (carId) release(carId);
    });
}

module.exports = { registerDriving, CAR_IDS };
