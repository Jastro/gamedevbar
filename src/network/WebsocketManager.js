import { NetworkEvents, NetworkConfig } from './NetworkEvents';
import { EventEmitter } from '../core/EventEmitter';

export class WebSocketManager extends EventEmitter {
    constructor() {
        super();
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.lastMessageTime = Date.now();
    }

    connect() {
        if (this.socket) {
            this.socket.close();
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = protocol === 'ws:' ? 
            `${protocol}//${window.location.hostname}:3000` : 
            `${protocol}//${window.location.hostname}`;
            
        this.socket = new WebSocket(url);
        this.setupSocketListeners();
    }

    setupSocketListeners() {
        this.socket.addEventListener('open', () => this.handleConnect());
        this.socket.addEventListener('message', (event) => this.handleMessage(event));
        this.socket.addEventListener('close', () => this.handleDisconnect());
        this.socket.addEventListener('error', (error) => this.handleError(error));
    }

    handleConnect() {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit(NetworkEvents.CONNECT);
    }

    handleDisconnect() {
        this.isConnected = false;
        this.emit(NetworkEvents.DISCONNECT);
    
        if (this.reconnectAttempts < NetworkConfig.RECONNECT_ATTEMPTS) {
            setTimeout(() => {
                this.reconnectAttempts++;
                this.connect();
            }, NetworkConfig.RECONNECT_DELAY);
        }
    }

    handleMessage(event) {
        this.lastMessageTime = Date.now();
        try {
            const data = JSON.parse(event.data);
            
            // Manejo especial para mensajes de chat
            if (data.type === 'userChat') {
                // Enviar el mensaje al ChatUI
                window.game.ui.chat.addMessage({
                    userId: data.userId,
                    username: data.username,
                    message: data.message,
                    isEmote: data.isEmote,
                    isTaberna: data.isTaberna,
                    timestamp: data.timestamp
                });
            }
            
            this.emit(data.type, data);
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    }

    handleError(error) {
        console.error('WebSocket error:', error);
        this.emit(NetworkEvents.ERROR, error);
    }

    send(type, data = {}) {
        if (!this.isConnected) return;

        try {
            const message = { type, ...data };
            this.socket.send(JSON.stringify(message));
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    setupHeartbeat() {
        setInterval(() => {
            if (this.isConnected && 
                Date.now() - this.lastMessageTime > NetworkConfig.WS_TIMEOUT) {
                this.socket.close();
            }
        }, NetworkConfig.WS_TIMEOUT);
    }
}