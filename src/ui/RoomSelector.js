import { ROOMS, DEFAULT_ROOM_ID } from '../world/RoomLayout';

const STORAGE_KEY = 'selectedRoom';

// Lets the player pick which bar to spawn in. Options come from RoomLayout,
// so adding a room there is enough to list it here.
export class RoomSelector {
    constructor() {
        this.selectedRoom = DEFAULT_ROOM_ID;
    }

    init() {
        const container = document.getElementById('room-options');
        if (!container) {
            console.error('Room options container not found');
            return;
        }

        let saved = null;
        try {
            saved = localStorage.getItem(STORAGE_KEY);
        } catch {
            // Storage can be unavailable (private mode); fall back to the default.
        }
        if (ROOMS.some(room => room.id === saved)) {
            this.selectedRoom = saved;
        }

        container.innerHTML = '';
        ROOMS.forEach(room => {
            const option = document.createElement('div');
            option.className = 'room-option';
            option.dataset.room = room.id;
            option.setAttribute('role', 'radio');
            option.tabIndex = 0;

            const name = document.createElement('span');
            name.className = 'room-name';
            name.textContent = room.name;
            const tagline = document.createElement('span');
            tagline.className = 'room-tagline';
            tagline.textContent = room.tagline;
            option.append(name, tagline);

            const select = () => this.select(room.id, container);
            option.addEventListener('click', select);
            option.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    select();
                }
            });
            container.appendChild(option);
        });

        this.select(this.selectedRoom, container);
    }

    select(roomId, container) {
        this.selectedRoom = roomId;
        container.querySelectorAll('.room-option').forEach(option => {
            const isSelected = option.dataset.room === roomId;
            option.classList.toggle('selected', isSelected);
            option.setAttribute('aria-checked', String(isSelected));
        });
        try {
            localStorage.setItem(STORAGE_KEY, roomId);
        } catch {
            // Not critical: the choice just won't be remembered.
        }
    }

    getSelectedRoom() {
        return this.selectedRoom;
    }
}
