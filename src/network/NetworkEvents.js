// src/network/NetworkEvents.js
export const NetworkEvents = {
    // Eventos de conexión
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    ERROR: 'error',

    // Eventos de usuario
    INIT: 'init',
    USER_JOINED: 'userJoined',
    USER_LEFT: 'userLeft',
    USER_MOVED: 'userMoved',
    USER_USERNAME: 'userUsername',
    USER_CHAT: 'userChat',
    INIT_COMPLETED: 'initCompleted',

    // Eventos de asientos
    USER_SAT: 'userSat',
    USER_STOOD: 'userStood',

    // Eventos de duelo
    DUEL_REQUEST: 'duelRequest',
    DUEL_ACCEPTED: 'duelAccepted',
    DUEL_REJECTED: 'duelRejected',
    DUEL_CHOICE: 'duelChoice',
    DUEL_RESULT: 'duelResult',

    // Mensajes del sistema
    SYSTEM_MESSAGE: 'systemMessage',
    ERROR_MESSAGE: 'errorMessage',
    
    // Eventos del servidor
    BALL_POSITION: 'ballPosition',
    BALL_SYNC: 'ballSync'
};

// También podemos añadir algunas estructuras de datos comunes
export const MessageTypes = {
    CHAT: 'chat',
    EMOTE: 'emote',
    SYSTEM: 'system',
    TABERNA: 'taberna'
};

export const UserStates = {
    IDLE: 'idle',
    MOVING: 'moving',
    SITTING: 'sitting',
    DUELING: 'dueling'
};

// Constantes de red
export const NetworkConfig = {
    POSITION_UPDATE_RATE: 50, // ms
    RECONNECT_ATTEMPTS: 3,
    RECONNECT_DELAY: 2000, // ms
    WS_TIMEOUT: 5000 // ms
};