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
    }

    handleInit(data) {
        console.log('Inicializando jugador local');
        const initialPosition = new Vector3(0, 1, 0);
        this.localPlayer = new LocalPlayer(data.userId, initialPosition, this.game);
        this.players.set(data.userId, this.localPlayer);
        
        const selectedModel = this.game.ui.modelSelector.getSelectedModel();
        console.log('Selected model for local player:', selectedModel);
        
        // Enviar información al servidor
        this.game.network.send('setUsername', {
            username: this.game.username,
            selectedModel: selectedModel
        });
    
        // Enviar mensaje de bienvenida
        this.game.network.send('userChat', {
            type: 'userChat',
            userId: 'taberna',
            username: 'Taberna',
            message: `🍺 ¡el borracho de ${this.game.username} ha entrado a la taberna!`,
            isTaberna: true
        });
    
        // Enviar initCompleted después
        this.game.network.send('initCompleted', {
            username: this.game.username,
            selectedModel: selectedModel
        });
    }


    handleUserJoined(data) {
        if (data.userId === this.localPlayer?.id) return;
        
        console.log('Nuevo jugador conectado:', data);
        
        const position = new Vector3(data.position[0] || 0, data.position[1] || 1, data.position[2] || 0);
        const player = new RemotePlayer(data.userId, position, this.game);
        
        // Establecer el nombre y modelo del jugador
        player.setUsername(data.username);
        player.selectedModel = data.selectedModel;
        
        this.players.set(data.userId, player);
    
        // Enviar mensaje de bienvenida al chat
        this.game.ui.chat.addMessage({
            userId: 'taberna',
            username: 'Taberna',
            message: `🍺 ¡el borracho de ${data.username} ha entrado a la taberna!`,
            isTaberna: true
        });
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

    update(deltaTime) {
        for (const player of this.players.values()) {
            player.update(deltaTime);
        }
    }
}