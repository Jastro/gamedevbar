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
const ChatLog = new Array(); // Historial de chat
const CHAT_LOG_HISTORY_MAX_LENGTH = 50; // Máximo número de mensajes en el historial

class User {
    constructor(ws) {
        this.id = uuidv4();
        this.ws = ws;
        this.username = null;
        this.position = { x: 0, y: 1, z: 0 };
        this.rotation = 0;
        this.seatId = null;
        this.isInDuel = false;
        this.duelOpponent = null;
        this.duelChoice = null;
        this.selectedModel = 'pj'; // Modelo por defecto
    }

    setUsername(username) {
        this.username = username;
    }
}

// Enviar mensaje a todos excepto al remitente
function broadcast(ws, message) {
    wss.clients.forEach(client => {
        if (client !== ws) {
            client.send(JSON.stringify(message));
        }
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
    let existingUsersCount = 0;
    users.forEach((existingUser, existingWs) => {
        if (existingWs !== ws) {
            existingUsersCount++;
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
                const targetClient = [...wss.clients].find(client => 
                    users.get(client).id === data.targetId
                );
                const targetUser = users.get(targetClient);
                const challengerUser = user;

                if (targetUser && !targetUser.isInDuel && !challengerUser.isInDuel) {
                    console.log('Enviando solicitud de duelo:', {
                        from: challengerUser.id,
                        to: targetUser.id
                    });
                    
                    // Añadir mensaje al chat global
                    const duelRequestMessage = {
                        type: 'userChat',
                        userId: 'system',
                        username: 'Sistema',
                        message: `${challengerUser.username} ha retado a ${targetUser.username} a un duelo`,
                        isEmote: true
                    };
                    broadcastAll(duelRequestMessage);
                    
                    targetClient.send(JSON.stringify({
                        type: 'duelRequest',
                        targetId: data.targetId,
                        challengerId: challengerUser.id,
                        challengerName: data.challengerName
                    }));
                }
                break;

            case 'duelAccepted':
                const challengerClient = [...wss.clients].find(client => 
                    users.get(client).id === data.challengerId
                );
                if (challengerClient) {
                    user.isInDuel = true;
                    user.duelOpponent = data.challengerId;
                    const challenger = users.get(challengerClient);
                    challenger.isInDuel = true;
                    challenger.duelOpponent = user.id;

                    challengerClient.send(JSON.stringify({
                        type: 'duelAccepted',
                        targetId: user.id,
                        challengerId: data.challengerId
                    }));
                }
                break;

            case 'duelRejected':
                const rejectedClient = [...wss.clients].find(client => 
                    users.get(client).id === data.challengerId
                );
                if (rejectedClient) {
                    rejectedClient.send(JSON.stringify({
                        type: 'duelRejected',
                        challengerId: data.challengerId
                    }));
                }
                break;

            case 'duelChoice':
                if (user.isInDuel && user.duelOpponent) {
                    user.duelChoice = data.choice;
                    const opponentClient = [...wss.clients].find(client => 
                        users.get(client).id === user.duelOpponent
                    );
                    
                    if (opponentClient) {
                        const opponent = users.get(opponentClient);
                        
                        // Enviar la elección al oponente
                        opponentClient.send(JSON.stringify({
                            type: 'duelChoice',
                            playerId: user.id,
                            choice: data.choice
                        }));

                        // Si ambos jugadores han elegido, enviar un mensaje de confirmación
                        if (user.duelChoice && opponent.duelChoice) {
                            const choiceEmojis = {
                                piedra: '🪨',
                                papel: '📄',
                                tijera: '✂️',
                                timeout: '⏰'
                            };

                            // Determinar el resultado
                            let resultEmoji;
                            if (user.duelChoice === opponent.duelChoice) {
                                resultEmoji = "🤝";
                            } else if (
                                (user.duelChoice === 'piedra' && opponent.duelChoice === 'tijera') ||
                                (user.duelChoice === 'papel' && opponent.duelChoice === 'piedra') ||
                                (user.duelChoice === 'tijera' && opponent.duelChoice === 'papel')
                            ) {
                                resultEmoji = "🏆";
                            } else {
                                resultEmoji = "💔";
                            }

                            // Enviar resultado a ambos jugadores
                            const result = {
                                type: 'duelResult',
                                player1: {
                                    id: user.id,
                                    choice: user.duelChoice,
                                    username: user.username
                                },
                                player2: {
                                    id: opponent.id,
                                    choice: opponent.duelChoice,
                                    username: opponent.username
                                },
                                choiceEmojis: choiceEmojis
                            };
                            
                            ws.send(JSON.stringify(result));
                            opponentClient.send(JSON.stringify(result));

                            // Añadir el resultado al chat global con el formato deseado
                            const duelResult = {
                                type: 'userChat',
                                userId: 'taberna',
                                username: '',
                                message: `${
                                    user.duelChoice === opponent.duelChoice ? 
                                        `¡${user.username} y ${opponent.username} han empatado como buenos bebedores!` :
                                    (
                                        (user.duelChoice === 'piedra' && opponent.duelChoice === 'tijera') ||
                                        (user.duelChoice === 'papel' && opponent.duelChoice === 'piedra') ||
                                        (user.duelChoice === 'tijera' && opponent.duelChoice === 'papel')
                                    ) ?
                                        `¡El borracho de ${user.username} ha ganado a ${opponent.username}!` :
                                        `¡El borracho de ${opponent.username} ha ganado a ${user.username}!`
                                } (${choiceEmojis[user.duelChoice]}) vs (${choiceEmojis[opponent.duelChoice]}) ${resultEmoji}`,
                                isTaberna: true,
                                timestamp: Date.now()
                            };

                            // Añadir al historial y enviar a todos
                            ChatLog.push(duelResult);
                            broadcastAll(duelResult);

                            // Mantener el límite del historial
                            if (ChatLog.length > CHAT_LOG_HISTORY_MAX_LENGTH) {
                                ChatLog.shift();
                            }

                            // Resetear el estado del duelo
                            user.isInDuel = false;
                            user.duelOpponent = null;
                            user.duelChoice = null;
                            opponent.isInDuel = false;
                            opponent.duelOpponent = null;
                            opponent.duelChoice = null;
                        }
                    }
                }
                break;

            case 'setUsername':
                user.setUsername(data.username);
                user.selectedModel = data.selectedModel;
                broadcastAll({
                    type: 'userUsername',
                    userId: user.id,
                    username: data.username,
                    selectedModel: data.selectedModel
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
                let messageData = {
                    type: 'userChat',
                    userId: user.id,
                    username: user.username,
                    message: data.message,
                    isEmote: data.isEmote,
                    emoji: data.emoji,
                    timestamp: Date.now() // Añadir timestamp para ordenar mensajes
                };

                // Añadir mensaje al historial
                ChatLog.push(messageData);

                // Mantener el límite de mensajes en el historial
                if (ChatLog.length > CHAT_LOG_HISTORY_MAX_LENGTH) {
                    ChatLog.shift();
                }

                // Enviar a todos los usuarios conectados
                broadcastAll(messageData);
                break;

            case 'initCompleted':
                user.username = data.username;
                user.selectedModel = data.selectedModel;

                // Informar a todos los demás usuarios sobre el nuevo usuario
                broadcast(ws, {
                    type: 'userJoined',
                    userId: user.id,
                    username: user.username,
                    position: user.position,
                    rotation: user.rotation,
                    selectedModel: user.selectedModel
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
                            seatId: existingUser.seatId,
                            selectedModel: existingUser.selectedModel
                        }));
                    }
                });

                // Enviar historial de chat al nuevo usuario
                if (ChatLog.length > 0) {
                    // Enviar mensaje especial indicando inicio del historial
                    //ws.send(JSON.stringify({
                    //    type: 'userChat',
                    //    userId: 'taberna',
                    //    message: '=== Historial de mensajes recientes ===',
                    //    isTaberna: true
                    //}));

                    // Enviar todos los mensajes del historial
                    ChatLog.forEach(chatMessage => {
                        ws.send(JSON.stringify(chatMessage));
                    });

                    // Enviar mensaje especial indicando fin del historial
                    //ws.send(JSON.stringify({
                    //    type: 'userChat',
                    //    userId: 'taberna',
                    //    message: '=== Fin del historial ===',
                    //    isTaberna: true
                    //}));
                }

                // Añadir mensaje de bienvenida al chat después del historial
                const welcomeMessage = {
                    type: 'userChat',
                    userId: 'taberna',
                    message: `🍺 ¡el borracho de ${data.username} ha entrado a la taberna!`,
                    isTaberna: true,
                    timestamp: Date.now()
                };
                ChatLog.push(welcomeMessage);
                broadcastAll(welcomeMessage);
                break;
        }
    });

    ws.on('close', () => {
        const user = users.get(ws);
        
        // Añadir mensaje de despedida al chat
        if (user && user.username) {
            const goodbyeMessage = {
                type: 'userChat',
                userId: 'taberna',
                message: `🚶 ${user.username} ha salido de la taberna...`,
                isTaberna: true,
                timestamp: Date.now()
            };
            ChatLog.push(goodbyeMessage);
            broadcastAll(goodbyeMessage);
        }

        if (user.isInDuel && user.duelOpponent) {
            const opponentClient = [...wss.clients].find(client => 
                users.get(client).id === user.duelOpponent
            );
            if (opponentClient) {
                const opponent = users.get(opponentClient);
                opponent.isInDuel = false;
                opponent.duelOpponent = null;
                opponentClient.send(JSON.stringify({
                    type: 'duelChoice',
                    playerId: user.id,
                    choice: 'timeout'
                }));
            }
        }

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