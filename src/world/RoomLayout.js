// Single source of truth for where each bar sits in the world.
// Every room is built in the same local frame (the original Gamedev layout:
// x in [-15, 15], z in [-10, 10], front wall at z = +10) and then placed with
// an origin + Y rotation.
// The world is a hub: a round plaza with up to SLOT_COUNT bars around it,
// each facing the middle with its door on the plaza's edge; a small road
// between each pair of bars leads out to a ring road, and a low wall closes
// the map past it. Everything here follows from the room size, so bigger
// rooms push the plaza and the roads out by themselves.

export const ROOM_HALF_WIDTH = 15;   // local x extent
export const ROOM_HALF_DEPTH = 10;   // local z extent (front wall at +z)
export const WALL_HEIGHT = 8;
// The upper gallery along the front wall (UpperFloor.js): its floor's top,
// thickness and inner edge (it runs from there to the front wall).
export const GALLERY = { top: 5, thickness: 0.3, edgeZ: 6.5 };
// The doorway from the gallery to the terrace, in the front wall above the entrance.
export const TERRACE_DOOR = { width: 2, height: 2.4 };
export const WALL_THICKNESS = 0.2;

// Entrance cut into the front wall, in room-local coordinates (centered).
// The forum TV hangs on the same wall, to the side (see Bar.createForumTV).
export const FRONT_DOOR = {
    x: 0,
    width: 2,
    height: 3
};

// The bar, against the back wall (room-local z). level.json had the counter at
// -3 and the back shelf at -7; both moved back by BAR_SHIFT (2026-10-23), the
// stools and everything on the counter with them, keeping the same gap.
export const BAR_SHIFT = -2.65;
export const BAR_COUNTER_Z = -3 + BAR_SHIFT;  // center; 2 deep, top at 1.3
export const BACK_BAR_Z = -7 + BAR_SHIFT;     // center; 0.5 deep, against the wall

// --- The hub -----------------------------------------------------------------
export const SLOT_COUNT = 6;
export const RADIAL_ROAD_WIDTH = 6;   // between neighboring bars' front corners
export const RING_ROAD_WIDTH = 8;
const RING_ROAD_MARGIN = 3;           // ring road clear of the bars' back corners
const EDGE_MARGIN = 5;                // ring road to the wall at the map's edge
// Small enough that the bars' front walls (a hexagon around the plaza) leave
// exactly a road's width between neighbors.
export const PLAZA_RADIUS = (2 * ROOM_HALF_WIDTH + RADIAL_ROAD_WIDTH) / (2 * Math.tan(Math.PI / SLOT_COUNT));
// Gamedev (slot 0) stays at the world origin, facing +z toward the plaza.
export const PLAZA_CENTER = { x: 0, z: ROOM_HALF_DEPTH + PLAZA_RADIUS };
const BACK_CORNER_RADIUS = Math.hypot(PLAZA_RADIUS + 2 * ROOM_HALF_DEPTH, ROOM_HALF_WIDTH);
export const RING_ROAD = {
    inner: BACK_CORNER_RADIUS + RING_ROAD_MARGIN,
    outer: BACK_CORNER_RADIUS + RING_ROAD_MARGIN + RING_ROAD_WIDTH
};
export const WORLD_RADIUS = RING_ROAD.outer + EDGE_MARGIN; // the wall at the map's edge

// Slot k's angle around the plaza (slot 0 is Gamedev, south of it).
export function slotAngle(slot) {
    return (slot * 2 * Math.PI) / SLOT_COUNT;
}

// Unit vector from the plaza's center toward bearing `angle` (slot 0: -z).
export function bearing(angle) {
    return { x: -Math.sin(angle), z: -Math.cos(angle) };
}

// A bar in slot k: its center out along that bearing, turned so its front
// wall (local +z) faces the middle.
export function slotPlacement(slot) {
    const angle = slotAngle(slot);
    const direction = bearing(angle);
    const distance = PLAZA_RADIUS + ROOM_HALF_DEPTH;
    return {
        origin: { x: PLAZA_CENTER.x + direction.x * distance, z: PLAZA_CENTER.z + direction.z * distance },
        rotationY: angle
    };
}

// Where a player appears when choosing a room (room-local).
export const SPAWN_LOCAL = { x: 0, y: 1, z: 0 };

export const ROOMS = [
    {
        id: 'gamedev',
        name: 'Gamedev',
        tagline: 'La taberna de siempre',
        barSign: 'Gamedev MV',
        paintings: true,
        radioStation: 'rock-fm', // until someone changes it (src/audio/radioStations.js)
        // Wall finishes (src/world/WallTextures.js).
        exterior: 'whitewash',
        interior: 'wainscot',
        slot: 0
    },
    {
        id: 'desarrollo',
        name: 'Desarrollo',
        tagline: 'Justo al lado, en la plaza',
        barSign: 'Desarrollo MV',
        paintings: false,
        radioStation: 'megastar',
        exterior: 'whitewash',
        interior: 'wainscot',
        // Gamedev's neighbor around the plaza (a short walk, door to door).
        slot: 1
    }
].map(room => ({ ...room, ...slotPlacement(room.slot) }));

// The other slots hold closed buildings for now (src/world/ClosedBuilding.js).
export const FREE_SLOTS = Array.from({ length: SLOT_COUNT }, (_, slot) => slot)
    .filter(slot => !ROOMS.some(room => room.slot === slot));

export const DEFAULT_ROOM_ID = 'gamedev';

// Direct links: `/gamedev`, `/Desarrollo/`... → the room id, or null.
export function getRoomIdFromPath(pathname) {
    const name = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    return ROOMS.some(room => room.id === name) ? name : null;
}

export function getRoomDefinition(roomId) {
    return ROOMS.find(room => room.id === roomId) ?? ROOMS.find(room => room.id === DEFAULT_ROOM_ID);
}

// Room-local -> world, without needing a THREE object (used before the world exists).
export function roomLocalToWorld(definition, local) {
    const cos = Math.cos(definition.rotationY);
    const sin = Math.sin(definition.rotationY);
    return {
        x: definition.origin.x + local.x * cos + local.z * sin,
        y: local.y ?? 0,
        z: definition.origin.z - local.x * sin + local.z * cos
    };
}

export function getSpawnPosition(roomId) {
    return roomLocalToWorld(getRoomDefinition(roomId), SPAWN_LOCAL);
}
