// Single source of truth for where each bar sits in the world.
// Every room is built in the same local frame (the original Gamedev layout:
// x in [-15, 15], z in [-10, 10], front wall at z = +10) and then placed with
// an origin + Y rotation. Rotating by PI makes two rooms face each other.

export const ROOM_HALF_WIDTH = 15;   // local x extent
export const ROOM_HALF_DEPTH = 10;   // local z extent (front wall at +z)
export const WALL_HEIGHT = 8;
export const WALL_THICKNESS = 0.2;

// Entrance cut into the front wall, in room-local coordinates (centered).
// The forum TV hangs on the same wall, to the side (see Bar.createForumTV).
export const FRONT_DOOR = {
    x: 0,
    width: 2,
    height: 3
};

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
        origin: { x: 0, z: 0 },
        rotationY: 0
    },
    {
        id: 'desarrollo',
        name: 'Desarrollo',
        tagline: 'Al otro lado de la calle',
        barSign: 'Desarrollo MV',
        paintings: false,
        radioStation: 'kiss-fm',
        // Rotated 180 degrees straight across a 14-unit street, so the two
        // front doors face each other: Gamedev door at (0, 10), this one at (0, 24).
        origin: { x: 0, z: 34 },
        rotationY: Math.PI
    }
];

export const DEFAULT_ROOM_ID = 'gamedev';

// Walkable outdoor area between the two facades (world coordinates).
export const STREET = {
    minX: -25,
    maxX: 25,
    minZ: 10,
    maxZ: 24
};

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
