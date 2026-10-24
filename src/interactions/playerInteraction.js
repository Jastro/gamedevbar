// Someone's avatar: a click opens their profile (ProfileUI). No F: it would
// compete with everything else near you.
export function createPlayerInteraction(game) {
    return {
        type: 'player',
        use(object) {
            const player = object.userData.player;
            // A hidden avatar (a bartender behind walls) still catches the ray.
            if (player && object.visible) game.ui.profile.open(player);
        }
    };
}
