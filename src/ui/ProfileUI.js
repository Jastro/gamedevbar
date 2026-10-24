import { FloatingPanel } from './FloatingPanel';
import { ITEMS } from '../appearance/catalog';
import { MODEL_IDS } from '../core/PlayerProfile';
import { LEADERBOARD_CATEGORIES } from '../world/LeaderboardSync';

// Click someone's avatar: who they are (name, character, accessories,
// where they are), their week (from the leaderboards, server:
// server/features/profiles.js) and their coins, and a few ways to say hi.
// The bartender gets a card of his own.
const NPC_CARDS = {
    'npc:bartender:gamedev': 'Manolo, camarero de la taberna desde que se inventó el /gamedev/. No fía.',
    'npc:bartender:desarrollo': 'Paco, el camarero de Desarrollo. Dice que tiene un motor propio a medias.',
    'npc:bartender:feda': 'Fermín, el camarero de FEDA. Tiene opinión de todo y razón de nada.',
    'npc:bartender:offtopic': 'Lola, la camarera de Offtopic. Nadie sabe cómo llegó aquí, ni ella.',
    'npc:police': 'El Agente Porras. Patrulla la plaza desde que existe la plaza. Nunca ha pillado a nadie que corriera.'
};

export class ProfileUI {
    constructor(game) {
        this.game = game;
        this.panel = new FloatingPanel('profile-panel', '🪪 Perfil');
        this.body = document.createElement('div');
        this.body.className = 'profile-body';
        this.panel.body.appendChild(this.body);
        this.player = null;
        game.network.on('profile', (data) => {
            if (this.player && data.userId === this.player.id) this.render(data);
        });
    }

    open(player) {
        this.player = player;
        this.render(null);
        this.panel.open();
        if (!player.id.startsWith('npc:')) this.game.network.send('profileRequest', { userId: player.id });
    }

    where(player) {
        const room = this.game.world.getRoomAt(player.position);
        if (room) return player.position.y > 4 ? `en ${room.name}, arriba` : `en ${room.name}`;
        return player.drivingCar ? 'conduciendo por la plaza' : 'en la plaza';
    }

    render(data) {
        const player = this.player;
        const name = player.username ?? 'Alguien';
        this.body.replaceChildren();
        const add = (tag, className, text) => {
            const element = document.createElement(tag);
            if (className) element.className = className;
            if (text !== undefined) element.textContent = text;
            this.body.appendChild(element);
            return element;
        };
        const title = add('div', 'profile-name', name);
        if (player.appearance?.nameColor) title.style.color = player.appearance.nameColor;

        if (player.id.startsWith('npc:')) {
            add('div', 'profile-line', NPC_CARDS[player.id] ?? 'Trabaja aquí.');
            return;
        }
        const model = MODEL_IDS.indexOf(player.selectedModel);
        add('div', 'profile-line', `Personaje ${model === -1 ? '?' : model + 1} · ${this.where(player)}`);
        const worn = ['head', 'face', 'hand']
            .map(slot => ITEMS.find(item => item.id === player.appearance?.[slot]))
            .filter(Boolean);
        if (worn.length) add('div', 'profile-line', `Lleva: ${worn.map(item => `${item.icon} ${item.name}`).join(', ')}`);

        add('div', 'profile-section', 'Esta semana');
        if (!data) {
            add('div', 'profile-line muted', 'Cargando…');
        } else {
            const stats = data.stats ?? {};
            const lines = LEADERBOARD_CATEGORIES
                .filter(category => stats[category.id])
                .map(category => `${category.icon} ${category.label}: ${category.format(stats[category.id].value)} (${stats[category.id].rank}º)`);
            if (lines.length === 0) add('div', 'profile-line muted', 'Aún nada en el ranking.');
            lines.forEach(line => add('div', 'profile-line', line));
            add('div', 'profile-line', `🪙 ${data.coins ?? 0} monedas en la tragaperras`);
        }

        const local = this.game.players.localPlayer;
        if (!local || player === local) return;
        const actions = add('div', 'floating-panel-actions');
        const button = (label, onClick) => {
            const element = document.createElement('button');
            element.type = 'button';
            element.className = 'floating-panel-button';
            element.textContent = label;
            element.addEventListener('click', () => {
                onClick();
                this.panel.close();
            });
            actions.appendChild(element);
        };
        const say = (text) => this.game.ui.chat?.sendMessage(`/me ${text}`);
        button('👋 Saludar', () => {
            say(`saluda a ${name}`);
            this.game.gestureSync?.play('cheer');
        });
        button('🎯 Retar a dardos', () => say(`reta a ${name} a los dardos 🎯`));
        button('⚽ Retar al futbolín', () => say(`reta a ${name} a un futbolín ⚽`));
    }
}
