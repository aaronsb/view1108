// Auto quality. A software rasteriser starts low; a GPU starts high and is checked twice each time the room is shown:
// the probe, the median frame time over the first frames (after `skip`; `frames` of them, or as many as fit in
// `budget` ms) above `ms`, then the watch, the mean over the next `span` ms of frames above `ms`. Either drops to
// low for good (the indicator says "slow"). ?labprobe=<ms> starts high on any renderer and makes every frame take
// <ms> to the checks: the test hook for the decision path. lab.ts owns one and acts on its verdict.
const PROBE = { skip: 4, frames: 24, budget: 1500, ms: 24 };
const WATCH = { span: 2000, ms: 22 };

export class QualityCheck {
  probe: number[] | null = null;
  watch: { n: number; sum: number } | null = null;

  constructor(readonly fakeMs: number | null) {}

  /** Whether a check is running (and wants every frame's time). */
  get running(): boolean { return !!(this.probe || this.watch); }

  /** Begin the probe, or (`on` false) drop any check. */
  start(on: boolean): void { this.probe = on ? [] : null; this.watch = null; }

  /** One frame's time, ms. True when the check finds this machine too slow for high. */
  sample(ms: number): boolean {
    ms = this.fakeMs ?? ms;
    const p = this.probe, w = this.watch;
    if (p) {
      p.push(ms);
      const s = p.slice(PROBE.skip);
      if (s.length < PROBE.frames && s.reduce((a, b) => a + b, 0) < PROBE.budget) return false;
      this.probe = null;
      if (s.sort((a, b) => a - b)[s.length >> 1] > PROBE.ms) return true;
      this.watch = { n: 0, sum: 0 };
    } else if (w) {
      w.n++; w.sum += ms;
      if (w.sum < WATCH.span) return false;
      this.watch = null;
      if (w.sum / w.n > WATCH.ms) return true;
    }
    return false;
  }
}
