// Someone's avatar: a click opens their profile (ProfileUI). No F: it would
// compete with everything else near you.
export function createPlayerInteraction(game) {
    return {
        type: 'player',
        use(object) {
            const player = object.userData.player;
            if (player) game.ui.profile.open(player);
        }
    };
}
