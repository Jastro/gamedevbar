// Everything in the bathrooms (src/world/Bathroom.js), click or F. Fixtures
// only work from inside the cubicle (canReach), so nothing is used through
// the partition; the door works from both sides.

const inside = (game) => (object, position) => object.userData.bathroom.containsPoint(position);

function fixture(game, type, range, hint, act) {
    return {
        type,
        range,
        canReach: inside(game),
        hint,
        use(object) {
            const player = game.players.localPlayer;
            const bathroom = object.userData.bathroom;
            if (!player || !bathroom) return;
            if (!bathroom.containsPoint(player.position)) {
                game.ui.chat?.addMessage({ type: 'system', message: '¡Entra al baño primero!' });
                return;
            }
            act(bathroom, player);
        }
    };
}

export function createBathroomInteractions(game) {
    const sync = () => game.bathroomSync;
    const DOOR_REACH = 2;
    return [
        {
            type: 'bathroomDoor',
            range: 1.6,
            hint(object) {
                const { state } = object.userData.bathroom;
                if (state.latchedBy && state.latchedBy !== game.players.localPlayer?.id) return 'Ocupado (cerrado por dentro)';
                return `${state.doorOpen ? 'Cerrar' : 'Abrir'} puerta del baño`;
            },
            use(object) {
                const player = game.players.localPlayer;
                const bathroom = object.userData.bathroom;
                if (!player || player.isSitting) return;
                const door = object.getWorldPosition(object.position.clone());
                if (Math.hypot(door.x - player.position.x, door.z - player.position.z) > DOOR_REACH) {
                    game.ui.chat?.addMessage({ type: 'system', message: '¡Acércate más a la puerta!' });
                    return;
                }
                sync().toggleDoor(bathroom);
            }
        },
        fixture(game, 'bathroomLatch', 1.8,
            (object) => object.userData.bathroom.state.latchedBy ? 'Quitar el pestillo' : 'Echar el pestillo',
            (bathroom) => sync().toggleLatch(bathroom)),
        fixture(game, 'toilet', 1.6, () => 'Usar el váter', (bathroom, player) => {
            if (player.isSitting) return;
            sync().useToilet(bathroom);
        }),
        fixture(game, 'toiletFlush', 1.6, () => 'Tirar de la cadena', (bathroom) => sync().flush(bathroom)),
        fixture(game, 'sink', 1.6, () => 'Lavarse las manos', (bathroom) => sync().washHands(bathroom)),
        fixture(game, 'airFreshener', 1.6, () => 'Usar el ambientador', (bathroom) => sync().spray(bathroom)),
        fixture(game, 'bathroomLight', 1.6,
            (object) => `${object.userData.bathroom.state.lightOn ? 'Apagar' : 'Encender'} la luz del baño`,
            (bathroom) => sync().toggleLight(bathroom))
    ];
}
