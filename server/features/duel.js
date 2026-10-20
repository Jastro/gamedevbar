// Rock-paper-scissors duels between two players. Server side only: there is no
// client UI for it yet (see Docs/Systems.md known issues).
const DUEL_CHOICES = ['piedra', 'papel', 'tijera'];
const CHOICE_EMOJIS = { piedra: '🪨', papel: '📄', tijera: '✂️', timeout: '⏰' };
const BEATS = { piedra: 'tijera', papel: 'piedra', tijera: 'papel' };

function resetDuel(user) {
    user.isInDuel = false;
    user.duelOpponent = null;
    user.duelChoice = null;
}

function registerDuel(hub) {
    hub.onConnect(({ user }) => resetDuel(user));

    hub.on('duelRequest', ({ user: challenger }, data) => {
        const target = hub.findUser(data.targetId);
        if (!target || target.user.isInDuel || challenger.isInDuel) return;

        hub.broadcastAll({
            type: 'userChat',
            userId: 'system',
            username: 'Sistema',
            message: `${challenger.username} ha retado a ${target.user.username} a un duelo`,
            isEmote: true
        });
        hub.send(target.ws, {
            type: 'duelRequest',
            targetId: data.targetId,
            challengerId: challenger.id,
            challengerName: challenger.username
        });
    });

    hub.on('duelAccepted', ({ user }, data) => {
        const challenger = hub.findUser(data.challengerId);
        if (!challenger) return;
        user.isInDuel = true;
        user.duelOpponent = data.challengerId;
        challenger.user.isInDuel = true;
        challenger.user.duelOpponent = user.id;
        hub.send(challenger.ws, { type: 'duelAccepted', targetId: user.id, challengerId: data.challengerId });
    });

    hub.on('duelRejected', (ctx, data) => {
        const challenger = hub.findUser(data.challengerId);
        if (challenger) hub.send(challenger.ws, { type: 'duelRejected', challengerId: data.challengerId });
    });

    hub.on('duelChoice', ({ ws, user }, data) => {
        if (!DUEL_CHOICES.includes(data.choice) || !user.isInDuel || !user.duelOpponent) return;
        user.duelChoice = data.choice;
        const opponentEntry = hub.findUser(user.duelOpponent);
        if (!opponentEntry) return;
        const opponent = opponentEntry.user;

        // Enviar la elección al oponente
        hub.send(opponentEntry.ws, { type: 'duelChoice', playerId: user.id, choice: data.choice });
        if (!opponent.duelChoice) return;

        const result = {
            type: 'duelResult',
            player1: { id: user.id, choice: user.duelChoice, username: user.username },
            player2: { id: opponent.id, choice: opponent.duelChoice, username: opponent.username },
            choiceEmojis: CHOICE_EMOJIS
        };
        hub.send(ws, result);
        hub.send(opponentEntry.ws, result);

        let outcome;
        let resultEmoji;
        if (user.duelChoice === opponent.duelChoice) {
            outcome = `¡${user.username} y ${opponent.username} han empatado como buenos bebedores!`;
            resultEmoji = '🤝';
        } else if (BEATS[user.duelChoice] === opponent.duelChoice) {
            outcome = `¡El borracho de ${user.username} ha ganado a ${opponent.username}!`;
            resultEmoji = '🏆';
        } else {
            outcome = `¡El borracho de ${opponent.username} ha ganado a ${user.username}!`;
            resultEmoji = '💔';
        }
        hub.announce(`${outcome} (${CHOICE_EMOJIS[user.duelChoice]}) vs (${CHOICE_EMOJIS[opponent.duelChoice]}) ${resultEmoji}`);

        resetDuel(user);
        resetDuel(opponent);
    });

    hub.onLeave(({ user }) => {
        if (!user.isInDuel || !user.duelOpponent) return;
        const opponent = hub.findUser(user.duelOpponent);
        if (!opponent) return;
        opponent.user.isInDuel = false;
        opponent.user.duelOpponent = null;
        hub.send(opponent.ws, { type: 'duelChoice', playerId: user.id, choice: 'timeout' });
    });
}

module.exports = { registerDuel };
