import { EventEmitter } from '../core/EventEmitter';

const STORAGE_KEY = 'audioVolumes';
export const VOLUME_CATEGORIES = ['radio', 'video', 'voice'];

// Per-player volume multipliers (0..1) for radio, projector video and other
// players' voices, remembered in localStorage. Emits 'change' (category, value).
export class AudioSettings extends EventEmitter {
    constructor() {
        super();
        this.volumes = { radio: 1, video: 1, voice: 1 };
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            VOLUME_CATEGORIES.forEach(category => {
                if (typeof saved[category] === 'number') this.volumes[category] = clamp(saved[category]);
            });
        } catch {
            // Storage unavailable or corrupt: keep defaults.
        }
    }

    get(category) {
        return this.volumes[category] ?? 1;
    }

    set(category, value) {
        if (!VOLUME_CATEGORIES.includes(category)) return;
        this.volumes[category] = clamp(value);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.volumes));
        } catch {
            // Not critical: the setting just won't be remembered.
        }
        this.emit('change', { category, value: this.volumes[category] });
    }
}

function clamp(value) {
    return Math.min(1, Math.max(0, Number(value) || 0));
}
