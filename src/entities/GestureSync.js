import { GESTURES } from './Gestures';

// Playing gestures (right click → Animaciones) and seeing everyone else's
// (server: server/features/gestures.js relays them).
export class GestureSync {
    constructor(game) {
        this.game = game;
    }

    bind() {
        const { network, players } = this.game;
        network.on('playerGesture', (data) => players.players.get(data.userId)?.playGesture(data.gesture));
        network.on('playerGestureStop', (data) => players.players.get(data.userId)?.stopGesture());
    }

    play(name) {
        const def = GESTURES[name];
        const player = this.game.players.localPlayer;
        if (!def || !player || this.game.playMode) return;
        // Dancing and push-ups need you on your feet.
        if (def.standing && player.isSitting) player.standUp();
        player.playGesture(name);
        this.game.network.send('playerGesture', { gesture: name });
    }

    // Moving cuts your gesture short (LocalPlayer).
    stop() {
        const player = this.game.players.localPlayer;
        if (!player?.gesture || player.gesture.stopping) return;
        player.stopGesture();
        this.game.network.send('playerGestureStop', {});
    }
}
