import { Game } from './core/Game';

window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    window.game = game; // Para acceso desde la consola si es necesario
});