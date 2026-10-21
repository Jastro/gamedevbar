import * as THREE from 'three';
import { Bar } from './Bar';
import { Furniture } from './Furniture';
import { Radio } from './Radio';
import { Paintings } from './Paintings';
import { ArcadePong } from './ArcadePong';
import { ArcadeSnake } from './ArcadeSnake';
import { Door, DOOR_INTERACT_DISTANCE } from './Door';
import { Projector } from './Projector';
import { DEFAULT_ROOM_ID } from './RoomLayout';

// Props and interactive objects. Every room gets its own full set, built in
// room-local coordinates (see RoomLayout.js).
export class Environment {
    constructor(scene, world, serverClock, audioSettings) {
        this.scene = scene;
        this.world = world;
        this.serverClock = serverClock;
        this.audioSettings = audioSettings;
        this.rooms = new Map();  // roomId -> { room, bar, furniture, radio, paintings, arcadePong, arcadeSnake, door, projector }
        this.doors = new Map();  // doorId -> Door
    }

    create() {
        this.world.rooms.forEach(room => {
            const hasPaintings = room.definition.paintings !== false;
            const contents = {
                room,
                bar: new Bar(room, room.definition.barSign),
                furniture: new Furniture(room),
                radio: new Radio(room),
                paintings: hasPaintings ? new Paintings(room) : null,
                arcadePong: new ArcadePong(room),
                arcadeSnake: new ArcadeSnake(room),
                door: new Door(room, this.world.collisionManager),
                projector: new Projector(room, this.serverClock, this.audioSettings)
            };

            contents.bar.create();
            contents.furniture.create();
            contents.radio.create();
            if (contents.paintings) contents.paintings.create();
            contents.arcadeSnake.create({ x: -12, y: 2, z: -8 });
            contents.arcadePong.create({ x: -7.5, y: 2, z: -8 });
            contents.door.create();
            contents.projector.create();
            if (contents.paintings) this.loadPaintings(contents.paintings);

            this.rooms.set(room.id, contents);
            this.doors.set(contents.door.id, contents.door);
        });

        // Gamedev room shortcuts, kept for code that predates multiple rooms.
        const main = this.rooms.get(DEFAULT_ROOM_ID);
        this.radio = main.radio;
        this.arcadePong = main.arcadePong;
        this.arcadeSnake = main.arcadeSnake;
    }

    loadPaintings(paintings) {
        const paintingsInfo = paintings.getPaintingsInfo();
        paintingsInfo.forEach((painting, index) => {
            const imageUrl = `/paintings/imagen${index + 1}.jpg`;
            paintings.loadImage(painting.id, imageUrl);
        });
    }

    initializeAudio(camera) {
        if (this.audioListener) return;
        this.audioListener = new THREE.AudioListener();
        camera.add(this.audioListener);
        this.rooms.forEach(({ radio }) => radio.initializeAudio(this.audioListener, this.audioSettings));
    }

    update(deltaTime, listenerPosition) {
        this.doors.forEach(door => door.update(deltaTime));
        if (listenerPosition) this.updateAudioOcclusion(listenerPosition);
        this.rooms.forEach(({ projector }) => projector.update(listenerPosition, this, this.world));
    }

    // Occlusion between two spaces (a Room, or null for the street): clear in
    // the same space, else muffled unless every door in between is open.
    getOcclusionLevel(sourceRoom, listenerRoom) {
        if (sourceRoom === listenerRoom) return 'none';
        const doorsInBetween = [sourceRoom, listenerRoom]
            .filter(Boolean)
            .map(room => this.rooms.get(room.id).door);
        return doorsInBetween.every(door => door.isOpen) ? 'doorOpen' : 'closed';
    }

    updateAudioOcclusion(listenerPosition) {
        const listenerRoom = this.world.getRoomAt(listenerPosition);
        this.rooms.forEach(({ room, radio }) => {
            const level = this.getOcclusionLevel(room, listenerRoom);
            radio.setOcclusion(level);
            radio.updateAudibility(level);
        });
    }

    getDoor(doorId) {
        return this.doors.get(doorId);
    }

    setDoorState(doorId, isOpen, instant = false) {
        const door = this.doors.get(doorId);
        if (door) door.setOpen(isOpen, instant);
    }

    getNearestDoor(worldPosition, maxDistance = DOOR_INTERACT_DISTANCE) {
        let nearest = null;
        let nearestDistance = maxDistance;
        this.doors.forEach(door => {
            const distance = door.distanceTo(worldPosition);
            if (distance <= nearestDistance) {
                nearest = door;
                nearestDistance = distance;
            }
        });
        return nearest;
    }

    isPlayingArcade(playerId) {
        for (const { arcadePong } of this.rooms.values()) {
            if (arcadePong.isPlayingGame(playerId)) return true;
        }
        return false;
    }

    updateSnakeHighScores(scores) {
        this.rooms.forEach(({ arcadeSnake }) => arcadeSnake.updateHighScores(scores));
    }
}
