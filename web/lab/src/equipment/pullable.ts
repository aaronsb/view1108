// Things on a shelf that come out toward the viewer when clicked (ours): a book pulled out of its row, a card lifted
// off the back. A Shelf holds them; one is out at a time, and the lab puts them all back when the camera leaves. An
// item with `opens` opens on a second click while it is out (the lab's `pull` route); the rest only come out.
import * as THREE from "three";

export interface PullSpec {
  /** Where it goes when out: an offset in its parent's frame, m. */
  offset: THREE.Vector3;
  /** And a turn on top of its resting one (radians, its own axes). */
  turn?: THREE.Euler;
  /** A second click while it is out opens it. */
  opens?: boolean;
}

/** One item: its rest pose (taken when added) and its out pose, eased between. */
export class Pullable {
  readonly opens: boolean;
  private rest: { p: THREE.Vector3; q: THREE.Quaternion };
  private out: { p: THREE.Vector3; q: THREE.Quaternion };
  private at = 0;
  want = 0;
  constructor(readonly object: THREE.Object3D, spec: PullSpec) {
    this.opens = !!spec.opens;
    this.rest = { p: object.position.clone(), q: object.quaternion.clone() };
    this.out = { p: this.rest.p.clone().add(spec.offset), q: this.rest.q.clone().multiply(new THREE.Quaternion().setFromEuler(spec.turn ?? new THREE.Euler())) };
  }
  /** Ease toward where it is wanted (time constant `tau`, s). */
  update(dt: number, tau: number): void {
    if (this.at === this.want) return;
    this.at += (this.want - this.at) * (1 - Math.exp(-dt / tau));
    if (Math.abs(this.at - this.want) < 1e-3) this.at = this.want;
    const k = this.at * this.at * (3 - 2 * this.at);   // smoothstep over the exponential: a soft start and stop
    this.object.position.lerpVectors(this.rest.p, this.out.p, k);
    this.object.quaternion.slerpQuaternions(this.rest.q, this.out.q, k);
  }
}

export interface ShelfHints {
  /** Nothing out. */
  idle: string;
  /** An item that opens is out. */
  open: string;
  /** An item that does not open is out. */
  out: string;
}

/** A row of pullables: one out at a time. */
export class Shelf {
  private items: Pullable[] = [];
  private outItem: Pullable | null = null;
  constructor(private hints: ShelfHints, private tau = 0.18) {}

  /** Add `object` at its resting pose (place it first). */
  add(object: THREE.Object3D, spec: PullSpec): Pullable {
    const p = new Pullable(object, spec);
    this.items.push(p);
    return p;
  }
  /** That item out and every other back (null: all back). */
  set(item: Pullable | null): void {
    this.outItem = item;
    for (const p of this.items) p.want = p === item ? 1 : 0;
  }
  /** Put back whatever is out; false when nothing is. */
  putBack(): boolean { if (!this.outItem) return false; this.set(null); return true; }
  /** Put `item` back if it is the one out. */
  back(item: Pullable): void { if (this.outItem === item) this.set(null); }
  /** Is `item` the one out? */
  isOut(item: Pullable): boolean { return this.outItem === item; }
  /** A click on `item`: true when it was already out and opens (the caller opens it); otherwise it comes out. */
  pull(item: Pullable): boolean {
    if (this.outItem === item) return item.opens;
    this.set(item);
    return false;
  }
  /** The close-up's line for the shelf as it stands. */
  hint(): string { return !this.outItem ? this.hints.idle : this.outItem.opens ? this.hints.open : this.hints.out; }
  update(dt: number): void { for (const p of this.items) p.update(dt, this.tau); }

  /** The Equipment members for one item on this shelf: `select` (the camera flies to it: out; leaves: back),
   *  `pull`, `pulled` and `hint`. */
  member(item: Pullable): { select(on: boolean): void; pull(): boolean; pulled(): boolean; hint(): string } {
    return {
      select: on => on ? this.set(item) : this.back(item),
      pull: () => this.pull(item),
      pulled: () => this.outItem === item && item.opens,
      hint: () => this.hint(),
    };
  }
}
