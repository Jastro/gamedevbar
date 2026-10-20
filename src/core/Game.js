import * as THREE from 'three';
import { Config } from './Config';
import { InteractionSystem } from './InteractionSystem';
import { Scene } from '../rendering/Scene';
import { Renderer } from '../rendering/Renderer';
import { Camera } from '../rendering/Camera';
import { WebSocketManager } from '@network/WebSocketManager';
import { PlayerManager } from '../entities/PlayerManager';
import { World } from '../world/World';
import { Environment } from '../world/Environment';
import { DoorSync } from '../world/DoorSync';
import { SoccerGame } from '../world/SoccerGame';
import { getRoomDefinition } from '../world/RoomLayout';
import { VoiceChat } from '../voice/VoiceChat';
import { ChatUI } from '@/ui/ChatUI';
import { ModelSelector } from '../ui/ModelSelector';
import { RoomSelector } from '../ui/RoomSelector';
import { StartScreen } from '../ui/StartScreen';
import { VoiceUI } from '../ui/VoiceUI';
import { VoiceSettingsUI } from '../ui/VoiceSettingsUI';
import { createDoorInteraction } from '../interactions/doorInteraction';
import { createSeatInteraction } from '../interactions/seatInteraction';
import { createRadioInteraction } from '../interactions/radioInteraction';
import { createArcadeInteraction, bindArcadeNetwork } from '../interactions/arcadeInteraction';

// Composition root: builds every system, wires them together and runs the
// main loop. Systems reach each other through this object (also window.game).
export class Game {
    constructor() {
        // Asignar la instancia del juego a window.game primero
        window.game = this;

        this.config = new Config();
        this.scene = new Scene();
        this.camera = new Camera(this.scene.getScene());
        this.renderer = new Renderer(this.scene, this.camera);
        this.world = new World(this.scene);
        this.environment = new Environment(this.scene, this.world);
        this.soccerGame = new SoccerGame(this.scene.getScene(), this.world);

        // Inicializar UI antes que network
        this.ui = {
            chat: new ChatUI(),
            modelSelector: new ModelSelector(),
            roomSelector: new RoomSelector()
        };

        this.network = new WebSocketManager();
        this.players = new PlayerManager(this);
        this.voice = new VoiceChat(this);
        this.ui.voice = new VoiceUI(this.voice, this.ui.chat);
        this.ui.voiceSettings = new VoiceSettingsUI(this.voice);
        this.doorSync = new DoorSync(this);

        this.interactions = new InteractionSystem(this);
        this.interactions.register(createSeatInteraction(this));
        this.interactions.register(createRadioInteraction(this));
        this.interactions.register(createArcadeInteraction(this));
        this.interactions.register(createDoorInteraction(this));

        this.startScreen = new StartScreen({
            modelSelector: this.ui.modelSelector,
            roomSelector: this.ui.roomSelector,
            onStart: (choice) => this.start(choice)
        });
        this.startScreen.init();
        this.clock = new THREE.Clock();
    }

    // Typing in the chat suspends movement and world input.
    get chatActive() {
        return this.ui.chat.isChatActive();
    }

    async start({ username, roomId }) {
        this.username = username;
        this.selectedRoomId = roomId;
        // Same view on entry in every room: camera on the entrance side, facing the bar.
        this.camera.rotation.horizontal = getRoomDefinition(roomId).rotationY;

        await this.init();
        this.setupInput();
        this.animate();

        this.environment.initializeAudio(this.camera.getCamera());
        this.ui.voice.showIntro();
    }

    async init() {
        this.renderer.init();
        await this.scene.waitForLoad();
        this.network.connect();
        this.world.create();
        this.environment.create();
        this.camera.setOccluderProvider(() => this.world.getCameraOccluders());
        this.bindNetwork();
        await this.soccerGame.init();
    }

    // Network → systems wiring that doesn't belong to a single system.
    bindNetwork() {
        this.doorSync.bind();
        bindArcadeNetwork(this);

        this.network.on('userChat', (data) => this.ui.chat.addMessage({
            userId: data.userId,
            username: data.username,
            message: data.message,
            isEmote: data.isEmote,
            isTaberna: data.isTaberna,
            emoji: data.emoji,
            timestamp: data.timestamp
        }));

        // Escuchar eventos del juego de fútbol
        this.network.on('startSoccerGame', (data) => {
            this.soccerGame.startGame(this.players.players);
            this.ui.chat.addMessage({
                type: 'system',
                message: `¡${this.players.players.get(data.initiatorId)?.username} ha iniciado un partido de fútbol!`
            });
        });
    }

    setupInput() {
        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener('contextmenu', (e) => e.preventDefault());
        this.interactions.attach();

        window.addEventListener('keydown', (e) => this.ui.voice.handleKey(e, true, this.chatActive));
        window.addEventListener('keyup', (e) => this.ui.voice.handleKey(e, false, this.chatActive));
        // Releasing the key in another window never reaches us.
        window.addEventListener('blur', () => this.voice.stopTalking());
    }

    handleResize() {
        this.camera.updateAspect(window.innerWidth / window.innerHeight);
        this.renderer.updateSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const deltaTime = this.clock.getDelta();
        this.update(deltaTime);
        this.render();
    }

    update(deltaTime) {
        const playerPosition = this.players.localPlayer?.position;

        this.players.update(deltaTime);
        this.world.update(deltaTime);
        this.soccerGame.update(deltaTime);
        this.environment.update(deltaTime, playerPosition);
        this.voice.update(playerPosition);
        this.interactions.update();

        // Actualizar posición de la cámara para seguir al jugador local
        if (this.players.localPlayer) {
            this.camera.updatePosition(this.players.localPlayer.mesh.position);
        }
    }

    render() {
        this.renderer.render();
    }
}
