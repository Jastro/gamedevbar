import { describeResult } from '../world/SlotMachine';

// Slot machines (server: server/features/slots.js): pulling the lever, the
// shared spins, your coins, and chat lines for the spinner (and for the whole
// bar on a jackpot).
const START_COINS = 100;
const JACKPOT = 1000; // three 🏆 GG EZ (server/features/slots.js)

export class SlotSync {
    constructor(game) {
        this.game = game;
        this.coins = START_COINS;
    }

    get localId() {
        return this.game.players.localPlayer?.id;
    }

    machine(roomId) {
        return this.game.environment.rooms.get(roomId)?.slotMachine ?? null;
    }

    bind() {
        const { network } = this.game;
        network.on('slotResult', (data) => {
            const machine = this.machine(data.roomId);
            if (!machine || !Array.isArray(data.reels)) return;
            if (data.userId === this.localId) {
                this.coins = data.coins;
                if (data.bailout) this.say('🎰 El dueño se apiada de ti y te fía 50 🪙.');
            }
            machine.startSpin(data);
        });
        network.on('slotBusy', () => this.say('🎰 Espera a que paren los rodillos.'));
        network.on('slotBroke', (data) => this.say(`🎰 Sin monedas. El dueño te fía más en ${data.retryIn} s.`));
    }

    say(message) {
        this.game.ui.chat?.addMessage({ type: 'system', message });
    }

    pull(machine) {
        if (machine.isSpinning()) return;
        this.game.network.send('slotSpin', { roomId: machine.id });
    }

    update(deltaTime) {
        const player = this.game.players.localPlayer;
        this.game.environment.rooms.forEach(({ slotMachine }) => {
            slotMachine.update(deltaTime, (spin) => {
                const text = describeResult(spin.reels, spin.win);
                if (spin.userId === this.localId) {
                    this.say(`🎰 ${text} · Tienes ${spin.coins} 🪙`);
                } else if (spin.win >= JACKPOT && player && this.game.world.getRoomAt(player.position) === slotMachine.room) {
                    this.say(`🏆 ¡${spin.name} ha sacado GG EZ en la tragaperras! JACKPOT +1000`);
                }
            });
        });
    }
}
