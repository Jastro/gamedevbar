import { LocalPlayer } from './LocalPlayer';
import { RemotePlayer } from './RemotePlayer';
import { Vector3 } from 'three';

export class PlayerManager {
    constructor(game) {
        this.game = game;
        this.players = new Map();
        this.localPlayer = null;
        this.setupNetworkHandlers();
    }

    setupNetworkHandlers() {
        this.game.network.on('userJoined', (data) => this.handleUserJoined(data));
        this.game.network.on('userLeft', (data) => this.handleUserLeft(data));
        this.game.network.on('userMoved', (data) => this.handleUserMoved(data));
        this.game.network.on('init', (data) => this.handleInit(data));
        this.game.network.on('userUsername', (data) => this.handleUserUpdate(data));
    }

    handleInit(data) {
        const initialPosition = new Vector3(0, 1, 0);
        const selectedModel = this.game.ui.modelSelector.getSelectedModel();

        // Crear el jugador local con el modelo seleccionado
        this.localPlayer = new LocalPlayer(data.userId, initialPosition, this.game);
        
        // Añadir el jugador al mapa inmediatamente para evitar duplicados
        this.players.set(data.userId, this.localPlayer);
        
        // Establecer el modelo
        this.localPlayer.setModel(selectedModel).then(() => {
            // Enviar información al servidor después de cargar el modelo
            this.game.network.send('setUsername', {
                username: this.game.username,
                selectedModel: selectedModel
            });

            // Enviar initCompleted después
            this.game.network.send('initCompleted', {
                username: this.game.username,
                selectedModel: selectedModel
            });
        }).catch(error => {
            console.error('Error initializing local player model:', error);
        });
    }

    handleUserJoined(data) {
        // Si es el jugador local, ignorar ya que ya fue creado en handleInit
        if (data.userId === this.localPlayer?.id) {
            return;
        }
        
        // Verificar si el jugador ya existe
        const existingPlayer = this.players.get(data.userId);
        if (existingPlayer) {
            if (data.username) existingPlayer.setUsername(data.username);
            if (data.selectedModel && existingPlayer.selectedModel !== data.selectedModel) {
                existingPlayer.setModel(data.selectedModel);
            }
            return;
        }

        // Crear posición inicial para el nuevo jugador
        const position = new Vector3(
            data.position ? data.position[0] : 0,
            data.position ? data.position[1] : 1,
            data.position ? data.position[2] : 0
        );

        // Crear nuevo jugador remoto
        const player = new RemotePlayer(data.userId, position, this.game);
        
        // Primero añadir al mapa de jugadores
        this.players.set(data.userId, player);

        // Luego establecer el modelo y nombre de usuario
        if (data.selectedModel) {
            player.setModel(data.selectedModel).then(() => {
                if (data.username) {
                    player.setUsername(data.username);
                }
            });
        } else if (data.username) {
            player.setUsername(data.username);
        }
    }

    handleUserLeft(data) {
        const player = this.players.get(data.userId);
        if (player) {
            player.cleanup();
            this.players.delete(data.userId);
        }
    }

    handleUserMoved(data) {
        const player = this.players.get(data.userId);
        if (player && player !== this.localPlayer) {
            player.updatePosition(data.position);
            player.updateRotation(data.rotation);
        }
    }

    handleUserUpdate(data) {
        const player = this.players.get(data.userId);
        if (!player) {
            // Si el jugador no existe, crearlo con los datos disponibles
            const position = new Vector3(0, 1, 0);
            const newPlayer = new RemotePlayer(data.userId, position, this.game);
            this.players.set(data.userId, newPlayer);
            
            if (data.selectedModel) {
                newPlayer.setModel(data.selectedModel).then(() => {
                    if (data.username) {
                        newPlayer.setUsername(data.username);
                    }
                });
            } else if (data.username) {
                newPlayer.setUsername(data.username);
            }
            return;
        }

        // Actualizar jugador existente
        if (data.username) {
            player.setUsername(data.username);
        }
        
        if (data.selectedModel && player.selectedModel !== data.selectedModel) {
            player.setModel(data.selectedModel);
        }
    }

    update(deltaTime) {
        for (const player of this.players.values()) {
            player.update(deltaTime);
        }
    }
}