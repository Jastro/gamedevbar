// "Heard through a wall" effect shared by everything that makes sound in a
// room (radios, voices). A low-pass filter plus a gain, driven by a level:
//   none     - listener in the same space as the source
//   doorOpen - different spaces, but every door in between is open
//   closed   - at least one closed door in between
// Tuned by ear; see Docs/PendingUserChecks.md.
export const OCCLUSION_LEVELS = {
    none: { frequency: 20000, gain: 1 },
    doorOpen: { frequency: 2500, gain: 0.8 },
    closed: { frequency: 450, gain: 0.55 }
};

const SMOOTHING = 0.15; // seconds (time constant)

export class OcclusionChain {
    constructor(context) {
        this.context = context;
        this.filter = context.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = OCCLUSION_LEVELS.none.frequency;
        this.gain = context.createGain();
        this.level = 'none';
    }

    // Pass to THREE.Audio#setFilters.
    get nodes() {
        return [this.filter, this.gain];
    }

    setLevel(level) {
        if (this.level === level || !OCCLUSION_LEVELS[level]) return;
        this.level = level;

        const target = OCCLUSION_LEVELS[level];
        const now = this.context.currentTime;
        this.filter.frequency.setTargetAtTime(target.frequency, now, SMOOTHING);
        this.gain.gain.setTargetAtTime(target.gain, now, SMOOTHING);
    }
}
