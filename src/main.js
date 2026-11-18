import { Game } from './core/Game';
import { initUIScale } from './ui/UIScale';

window.addEventListener('DOMContentLoaded', () => {
    initUIScale();
    const game = new Game();
    window.game = game; // Para acceso desde la consola si es necesario
});
