// Estimate of the server's clock, so shared media (projector videos) play at
// the same position for everyone. Each server timestamp is
// already a bit old when it arrives; the largest (serverTime - localTime)
// seen is the one with the least network delay, so keep that.
export class ServerClock {
    constructor() {
        this.offset = null;
    }

    sync(serverTime) {
        if (typeof serverTime !== 'number') return;
        const sample = serverTime - Date.now();
        if (this.offset === null || sample > this.offset) this.offset = sample;
    }

    now() {
        return Date.now() + (this.offset ?? 0);
    }
}
