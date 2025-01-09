// server.js
const express = require('express');
const path = require('path');
const app = express();
const { WebSocketServer } = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

// Crear servidor HTTP
const server = http.createServer(app);

// Crear servidor WebSocket usando el servidor HTTP
const wss = new WebSocketServer({ server });

// Servir archivos estáticos desde la carpeta dist
app.use(express.static(path.join(__dirname, 'dist')));

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Almacenar estado del servidor
const users = new Map(); // Mapa de usuarios conectados
const seats = new Map(); // Mapa de asientos ocupados

class User {
    constructor(ws) {
        this.id = uuidv4();
        this.ws = ws;
        this.username = null;
        this.position = { x: 0, y: 1, z: 0 };
        this.rotation = 0;
        this.seatId = null;
    }
}

// Enviar mensaje a todos excepto al remitente
function broadcast(ws, message) {
    wss.clients.forEach(client => {
        client.send(JSON.stringify(message));
    });
}

// Enviar mensaje a todos incluyendo al remitente
function broadcastAll(message) {
    wss.clients.forEach(client => {
        client.send(JSON.stringify(message));
    });
}

// Manejo de conexiones WebSocket
wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;

    const user = new User(ws);
    users.set(ws, user);

    // Enviar ID al nuevo usuario
    ws.send(JSON.stringify({
        type: 'init',
        userId: user.id
    }));

    // Informar a todos los demás usuarios sobre el nuevo usuario
    broadcast(ws, {
        type: 'userJoined',
        userId: user.id,
        username: user.username,
        position: user.position,
        rotation: user.rotation
    });

    // Enviar al nuevo usuario información sobre los usuarios existentes
    users.forEach((existingUser, existingWs) => {
        if (existingWs !== ws) {
            ws.send(JSON.stringify({
                type: 'userJoined',
                userId: existingUser.id,
                username: existingUser.username,
                position: existingUser.position,
                rotation: existingUser.rotation,
                seatId: existingUser.seatId
            }));
        }
    });

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        const user = users.get(ws);

        switch (data.type) {
            case 'duelRequest':
                const targetClient = [...wss.clients].find(client => users.get(client).id === data.targetId);
                if (targetClient) {
                    targetClient.send(JSON.stringify({
                        type: 'duelRequest',
                        challengerId: user.id,
                        challengerName: data.challengerName
                    }));
                }
                break;

            case 'duelAccepted':
                const challengerClient = [...wss.clients].find(client => users.get(client).id === data.challengerId);
                if (challengerClient) {
                    challengerClient.send(JSON.stringify({
                        type: 'duelAccepted',
                        targetId: user.id
                    }));
                }
                break;

            case 'duelChoice':
                broadcast(ws, {
                    type: 'duelChoice',
                    playerId: user.id,
                    choice: data.choice
                });
                break;
            case 'setUsername':
                user.username = data.username;
                // Informar a todos los usuarios del nuevo username
                broadcast(ws, {
                    type: 'userUsername',
                    userId: user.id,
                    username: data.username
                });
                break;
            case 'userMoved':
                user.position = data.position;
                user.rotation = data.rotation;
                broadcast(ws, {
                    type: 'userMoved',
                    userId: user.id,
                    position: data.position,
                    rotation: data.rotation
                });
                break;

            case 'userSat':
                if (seats.has(data.seatId)) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Seat already occupied'
                    }));
                    return;
                }

                // Liberar asiento anterior si existe
                if (user.seatId) {
                    seats.delete(user.seatId);
                }

                // Ocupar nuevo asiento
                user.seatId = data.seatId;
                seats.set(data.seatId, user.id);
                broadcast(ws, {
                    type: 'userSat',
                    userId: user.id,
                    seatId: data.seatId
                });
                break;

            case 'userStood':
                if (user.seatId) {
                    seats.delete(user.seatId);
                    user.seatId = null;
                    broadcast(ws, {
                        type: 'userStood',
                        userId: user.id
                    });
                }
                break;

            case 'userChat':
                broadcast(ws, {
                    type: 'userChat',
                    userId: user.id,
                    username: user.username,
                    message: data.message,
                    isEmote: data.isEmote
                });
                break;
        }
    });

    ws.on('close', () => {
        const user = users.get(ws);

        // Liberar asiento si el usuario estaba sentado
        if (user.seatId) {
            seats.delete(user.seatId);
        }

        // Informar a todos que el usuario se desconectó
        broadcast(ws, {
            type: 'userLeft',
            userId: user.id
        });

        users.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});