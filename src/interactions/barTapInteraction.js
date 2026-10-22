// The tap on each bar's counter: click or F to order a drink (DrinkSync).
const TAP_REACH = 3;

export function createBarTapInteraction(game) {
    return {
        type: 'barTap',
        range: 2.5,
        use(object) {
            const player = game.players.localPlayer;
            if (!player || player.isSitting) return;
            const inside = game.world.getRoomForObject(object) === game.world.getRoomAt(player.position);
            const distance = object.getWorldPosition(object.position.clone()).distanceTo(player.position);
            if (!inside || distance > TAP_REACH) {
                game.ui.chat?.addMessage({ type: 'system', message: '¡Acércate a la barra para pedir!' });
                return;
            }
            game.drinkSync.openMenu();
        },
        hint() {
            return 'Pedir una bebida';
        }
    };
}
