// server.js
const express = require('express');
const path = require('path');
const app = express();
const { WebSocketServer } = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const puppeteer = require('puppeteer');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Create HTTP server first
const server = http.createServer(app);

// Enable CORS for all routes
app.use(cors());

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Cache durations
const FORUM_CACHE_DURATION = 30 * 1000; // 30 seconds for forum data
const IMAGE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for images

// Cache for storing images temporarily
const imageCache = new Map();

// Clean up expired cache entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of imageCache.entries()) {
        if (now - value.timestamp > IMAGE_CACHE_DURATION) {
            imageCache.delete(key);
        }
    }
}, 60000); // Check every minute

// Image proxy endpoint
app.get('/proxy-image', async (req, res) => {
    try {
        const imageUrl = req.query.url;
        if (!imageUrl) {
            return res.status(400).send('No image URL provided');
        }

        const response = await fetch(imageUrl, {
            headers: {
                'Referer': 'https://www.mediavida.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            return res.status(response.status).send('Failed to fetch image');
        }

        const contentType = response.headers.get('content-type');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

        response.body.pipe(res);
    } catch (error) {
        console.error('Error proxying image:', error);
        res.status(500).send('Error fetching image');
    }
});

// Cache for forum posts
let forumPostsCache = [];
let lastFetchTime = 0;

// Function to fetch forum posts
async function fetchForumPosts() {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-software-rasterizer'
            ]
        });
        const page = await browser.newPage();
        
        // Set a reasonable timeout
        await page.setDefaultNavigationTimeout(30000);
        
        await page.goto('https://www.mediavida.com/foro/gamedev/gamedev-taberna-ahora-nuestro-propio-habbo-gamedev-718219/live', {
            waitUntil: 'networkidle0'
        });

        const posts = await page.evaluate(() => {
            const postElements = document.querySelectorAll('#posts-wrap .post');
            return Array.from(postElements).slice(0, 10).map(post => {
                // Username extraction
                const username = post.querySelector('.autor')?.textContent?.trim() || '';
                
                // Avatar extraction - try multiple selectors and sources
                let avatar = '';
                const avatarImg = post.querySelector('.avatar img, .avatar');
                if (avatarImg) {
                    // Try data-src first (lazy loading), then src
                    avatar = avatarImg.getAttribute('data-src') || avatarImg.getAttribute('src') || '';
                    
                    // If it's a relative URL, make it absolute
                    if (avatar && !avatar.startsWith('http')) {
                        avatar = 'https://www.mediavida.com' + (avatar.startsWith('/') ? '' : '/') + avatar;
                    }
                    
                    // Replace any default avatar with empty string
                    if (avatar.includes('pix.gif') || avatar.includes('default_avatar')) {
                        avatar = '';
                    }
                }
                
                // Message extraction
                const messageEl = post.querySelector('.post-contents');
                const message = messageEl ? messageEl.textContent.trim() : '';
                
                // Post number extraction
                const postNum = post.getAttribute('data-num') || '';
                
                return { 
                    username, 
                    avatar, 
                    message, 
                    postNum,
                    timestamp: Date.now() 
                };
            });
        });

        console.log('Fetched posts with avatars:', posts.map(p => ({ username: p.username, avatar: p.avatar })));
        forumPostsCache = posts;
        lastFetchTime = Date.now();
        return posts;
    } catch (error) {
        console.error('Error fetching forum posts:', error);
        return forumPostsCache; // Return cached posts on error
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Initialize cache on startup
fetchForumPosts().catch(console.error);

// Proxy endpoint for both forum data and images
app.get('/mv-proxy', async (req, res) => {
    try {
        // If imageUrl is provided, handle image proxy
        if (req.query.imageUrl) {
            const imageUrl = req.query.imageUrl;
            
            // Check cache first
            if (imageCache.has(imageUrl)) {
                const cachedImage = imageCache.get(imageUrl);
                if (Date.now() - cachedImage.timestamp < IMAGE_CACHE_DURATION) {
                    res.type(cachedImage.contentType);
                    return res.send(cachedImage.data);
                } else {
                    imageCache.delete(imageUrl);
                }
            }

            // Download image
            const imageResponse = await fetch(imageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.mediavida.com/',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
                },
                timeout: 5000 // 5 second timeout
            }).catch(error => {
                console.error(`Failed to fetch image ${imageUrl}:`, error);
                return null;
            });

            if (!imageResponse || !imageResponse.ok) {
                console.error(`Image fetch failed for ${imageUrl}: ${imageResponse?.status}`);
                return res.status(404).send('Image not found');
            }

            let contentType = imageResponse.headers.get('content-type');
            // Ensure we have a valid content type
            if (!contentType || !contentType.startsWith('image/')) {
                contentType = 'image/jpeg'; // Default to JPEG if no valid content type
            }

            const buffer = await imageResponse.buffer().catch(error => {
                console.error(`Failed to get buffer for ${imageUrl}:`, error);
                return null;
            });

            if (!buffer) {
                return res.status(500).send('Failed to process image');
            }

            // Cache the image
            imageCache.set(imageUrl, {
                data: buffer,
                contentType,
                timestamp: Date.now()
            });

            // Send response with appropriate headers
            res.set('Cache-Control', 'public, max-age=300'); // 5 minutes cache
            res.set('Content-Type', contentType);
            res.send(buffer);
            return;
        }

        // Handle forum data request
        if (Date.now() - lastFetchTime > FORUM_CACHE_DURATION) {
            console.log('Cache expired, fetching new posts');
            await fetchForumPosts();
        }
        
        if (forumPostsCache.length === 0) {
            console.log('Cache empty, fetching posts');
            await fetchForumPosts();
        }
        
        console.log(`Sending ${forumPostsCache.length} posts`);
        res.json({ posts: forumPostsCache });

    } catch (error) {
        console.error('Proxy error:', error);
        // En caso de error, devolver el caché existente si hay datos
        if (forumPostsCache.length > 0) {
            res.json({ posts: forumPostsCache });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Create WebSocket server
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
const snakeHighScores = [];
// Door states (doorId -> isOpen). Door ids come from the client layout
// ("<roomId>:front"), so they are validated and the map is capped.
const doors = new Map();
const DOOR_ID_PATTERN = /^[a-z0-9_-]{1,32}:[a-z0-9_-]{1,32}$/;
const MAX_DOORS = 64;

// Client input limits. Everything below comes straight from the socket, so it is
// type-checked and clamped before it is stored or relayed to other clients.
const MAX_USERNAME_LENGTH = 24;
const MAX_CHAT_LENGTH = 200;
const MAX_EMOJI_LENGTH = 16;
const MODEL_ID_PATTERN = /^[a-z0-9_-]{1,32}$/i;
const DUEL_CHOICES = ['piedra', 'papel', 'tijera'];
// WebRTC signaling (SDP + ICE candidates) is relayed as-is; an SDP is a few KB.
const MAX_VOICE_SIGNAL_BYTES = 16 * 1024;

// ICE servers handed to clients for voice chat. Set ICE_SERVERS to a JSON array
// (e.g. with a TURN server) for players behind strict NATs.
function loadIceServers() {
    const fallback = [{ urls: 'stun:stun.l.google.com:19302' }];
    if (!process.env.ICE_SERVERS) return fallback;
    try {
        const parsed = JSON.parse(process.env.ICE_SERVERS);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
    } catch (error) {
        console.error('Invalid ICE_SERVERS, using default STUN:', error.message);
        return fallback;
    }
}
const ICE_SERVERS = loadIceServers();

function cleanString(value, maxLength) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().slice(0, maxLength);
    return trimmed.length > 0 ? trimmed : null;
}

function cleanUsername(value) {
    return cleanString(value, MAX_USERNAME_LENGTH) || 'Anónimo';
}

// The model id ends up in a client asset path (/assets/models/<id>.glb).
function cleanModelId(value) {
    return typeof value === 'string' && MODEL_ID_PATTERN.test(value) ? value : 'pj';
}

// Every push goes through here so join/leave spam can't grow the history without bound.
function addToChatLog(entry) {
    ChatLog.push(entry);
    while (ChatLog.length > CHAT_LOG_HISTORY_MAX_LENGTH) {
        ChatLog.shift();
    }
}

// Users can disconnect between a message being sent and handled, so lookups may miss.
function findClientByUserId(userId) {
    return [...wss.clients].find(client => users.get(client)?.id === userId);
}

class User {
    constructor(ws) {
        this.id = uuidv4();
        this.ws = ws;
        this.username = null;
        this.position = [0, 1, 0]; // same [x, y, z] shape clients send in userMoved
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

// Dispatch one parsed client message. `data` is untrusted: check fields before use.
function handleMessage(ws, user, data) {
    switch (data.type) {
        case 'snakeHighScore':
            if (typeof data.score !== 'number' || !Number.isFinite(data.score)) break;
            // Añadir nuevo high score
            snakeHighScores.push({
                name: cleanUsername(data.username),
                score: data.score
            });
            // Ordenar por puntuación
            snakeHighScores.sort((a, b) => b.score - a.score);
            // Mantener solo los top 10
            if (snakeHighScores.length > 10) {
                snakeHighScores.length = 10;
            }
            // Broadcast a todos los jugadores
            broadcastAll({
                type: 'snakeHighScores',
                scores: snakeHighScores
            });
            break;
        case 'arcadeState':
            const arcade = data;
            broadcastAll({
                type: 'arcadeState',
                gameState: data.gameState,
                data: data.data
            });
            switch (arcade.type) {
                case 'startGame':
                    broadcastAll({
                        type: 'arcadeUpdate',
                        action: 'startGame',
                        playerId: arcade.playerId
                    });
                    break;

                case 'playerJoined':
                    // Enviar mensaje de que se unió un jugador
                    broadcastAll({
                        type: 'arcadeUpdate',
                        action: 'playerJoined',
                        playerId: arcade.playerId
                    });

                    // Esperar 3 segundos y reiniciar el juego
                    setTimeout(() => {
                        broadcastAll({
                            type: 'arcadeUpdate',
                            action: 'startTwoPlayer',
                            player1Id: data.currentPlayerId,
                            player2Id: arcade.playerId
                        });
                    }, 3000);
                    break;

                case 'gameState':
                    // Actualizar estado del juego (posiciones, puntuaciones, etc)
                    broadcastAll({
                        type: 'arcadeUpdate',
                        action: 'updateState',
                        state: arcade.state
                    });
                    break;
            }
            break;
        case 'duelRequest':
            const targetClient = findClientByUserId(data.targetId);
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
                    challengerName: challengerUser.username
                }));
            }
            break;

        case 'duelAccepted':
            const challengerClient = findClientByUserId(data.challengerId);
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
            const rejectedClient = findClientByUserId(data.challengerId);
            if (rejectedClient) {
                rejectedClient.send(JSON.stringify({
                    type: 'duelRejected',
                    challengerId: data.challengerId
                }));
            }
            break;

        case 'duelChoice':
            if (!DUEL_CHOICES.includes(data.choice)) break;
            if (user.isInDuel && user.duelOpponent) {
                user.duelChoice = data.choice;
                const opponentClient = findClientByUserId(user.duelOpponent);

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
                            message: `${user.duelChoice === opponent.duelChoice ?
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
                        addToChatLog(duelResult);
                        broadcastAll(duelResult);

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
            user.setUsername(cleanUsername(data.username));
            user.selectedModel = cleanModelId(data.selectedModel);
            broadcastAll({
                type: 'userUsername',
                userId: user.id,
                username: user.username,
                selectedModel: user.selectedModel
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

        case 'doorToggle': {
            const doorId = data.doorId;
            if (typeof doorId !== 'string' || !DOOR_ID_PATTERN.test(doorId)) break;
            if (!doors.has(doorId) && doors.size >= MAX_DOORS) break;

            const isOpen = !doors.get(doorId);
            doors.set(doorId, isOpen);
            broadcastAll({ type: 'doorState', doorId, isOpen });
            break;
        }

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
            const chatText = cleanString(data.message, MAX_CHAT_LENGTH);
            if (!chatText) break;

            let messageData = {
                type: 'userChat',
                userId: user.id,
                username: user.username,
                message: chatText,
                isEmote: data.isEmote === true,
                emoji: cleanString(data.emoji, MAX_EMOJI_LENGTH),
                timestamp: Date.now()
            };

            // Manejar comando de fútbol
            if (chatText.toLowerCase() === '/furbo') {
                // Cambiar estado del juego
                const isGameActive = chatText.toLowerCase() === '/furbo';
                broadcastAll({
                    type: 'startSoccerGame',
                    initiatorId: user.id,
                    active: isGameActive
                });
                return;
            }

            // Añadir mensaje al historial
            addToChatLog(messageData);

            // Enviar a todos los usuarios conectados
            broadcastAll(messageData);
            break;

        case 'initCompleted':
            user.username = cleanUsername(data.username);
            user.selectedModel = cleanModelId(data.selectedModel);

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
                        selectedModel: existingUser.selectedModel,
                        seatId: existingUser.seatId
                    }));
                }
            });

            // Current door states, so the newcomer sees open doors as open
            ws.send(JSON.stringify({
                type: 'doorStates',
                doors: Object.fromEntries(doors)
            }));

            // Enviar historial de chat al nuevo usuario
            if (ChatLog.length > 0) {

                // Enviar todos los mensajes del historial
                ChatLog.forEach(chatMessage => {
                    ws.send(JSON.stringify(chatMessage));
                });
            }

            // Añadir mensaje de bienvenida al chat después del historial
            const welcomeMessage = {
                type: 'userChat',
                userId: 'taberna',
                message: `🍺 ¡El borracho de ${user.username} ha entrado!`,
                isTaberna: true,
                timestamp: Date.now()
            };
            addToChatLog(welcomeMessage);
            broadcastAll(welcomeMessage);
            break;

        case 'voiceSignal': {
            // Relay only to the addressed peer; the server never inspects media.
            if (typeof data.targetId !== 'string' || !data.signal || typeof data.signal !== 'object') break;
            if (JSON.stringify(data.signal).length > MAX_VOICE_SIGNAL_BYTES) break;
            const targetClient = findClientByUserId(data.targetId);
            if (!targetClient) break;
            targetClient.send(JSON.stringify({
                type: 'voiceSignal',
                fromId: user.id,
                signal: data.signal
            }));
            break;
        }

        case 'voiceTalking':
            broadcast(ws, {
                type: 'voiceTalking',
                userId: user.id,
                talking: data.talking === true
            });
            break;

        case 'soccerBallUpdate':
            // Reenviar la actualización de la pelota a todos los clientes excepto al remitente
            broadcast(ws, {
                type: 'soccerBallUpdate',
                position: data.position,
                velocity: data.velocity
            });
            break;
    }
}

// Manejo de conexiones WebSocket
wss.on('connection', (ws, req) => {
    const user = new User(ws);
    users.set(ws, user);

    // Enviar ID al nuevo usuario
    ws.send(JSON.stringify({
        type: 'init',
        userId: user.id,
        iceServers: ICE_SERVERS
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
        let data;
        try {
            data = JSON.parse(message);
        } catch (error) {
            console.warn(`Ignoring malformed WS frame from ${user.id}`);
            return;
        }
        if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;

        // A throwing handler must not take the whole process down.
        try {
            handleMessage(ws, user, data);
        } catch (error) {
            console.error(`Error handling '${data.type}' from ${user.id}:`, error);
        }
    });

    ws.on('close', () => {
        const user = users.get(ws);
        if (!user) return;

        // Añadir mensaje de despedida al chat
        if (user.username) {
            const goodbyeMessage = {
                type: 'userChat',
                userId: 'taberna',
                message: `🚶 ${user.username} ha salido de la taberna...`,
                isTaberna: true,
                timestamp: Date.now()
            };
            addToChatLog(goodbyeMessage);
            broadcastAll(goodbyeMessage);
        }

        if (user.isInDuel && user.duelOpponent) {
            const opponentClient = findClientByUserId(user.duelOpponent);
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