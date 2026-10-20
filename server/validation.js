const { LIMITS } = require('./config');

const MODEL_ID_PATTERN = /^[a-z0-9_-]{1,32}$/i;

function cleanString(value, maxLength) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().slice(0, maxLength);
    return trimmed.length > 0 ? trimmed : null;
}

function cleanUsername(value) {
    return cleanString(value, LIMITS.usernameLength) || 'Anónimo';
}

// The model id ends up in a client asset path (/assets/models/<id>.glb).
function cleanModelId(value) {
    return typeof value === 'string' && MODEL_ID_PATTERN.test(value) ? value : 'pj';
}

module.exports = { cleanString, cleanUsername, cleanModelId };
