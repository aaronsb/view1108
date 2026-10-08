// Things on a shelf that come out toward the viewer when clicked (ours): a book pulled out of its row, a card lifted
// off the back, a reel out of the tape rack. A Shelf holds them; one is out at a time, and the lab puts them back when
// the camera leaves (a reel stays out, carried: taperack.ts). An item with `opens` opens on a second click while it is
// out (the lab's `pull` route); the rest only come out. Shelves may be linked (`link`) into one group with one item out
// across all of them, and two items paired (`pair`), on one shelf or on two linked ones: while one is out its partner
// stands half out (HALF), a pointer to it, and goes back with it (the tape rack's reel and its mission notebook on the
// bookcase, #19/#29, ours). The half follows the out item: a carried reel keeps its binder half out across the room,
// and whatever puts the reel back (a mount, Esc) puts the binder back too.
import * as THREE from "three";

export interface PullSpec {
  /** Where it goes when out: an offset in its parent's frame, m. */
  offset: THREE.Vector3;
  /** And a turn on top of its resting one (radians, its own axes). */
  turn?: THREE.Euler;
  /** A second click while it is out opens it. */
  opens?: boolean;
}

/** How far a paired item comes out while its partner is out: a half-pull (ours). */
export const HALF = 0.45;

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

/** What linked shelves share: the one item out, and the pairs. */
class ShelfGroup {
  shelves: Shelf[] = [];
  out: Pullable | null = null;
  partners = new Map<Pullable, Pullable>();
}

/** A row of pullables: one out at a time across its group (itself, or the shelves linked to it). */
export class Shelf {
  private items: Pullable[] = [];
  private group = new ShelfGroup();
  constructor(private hints: ShelfHints, private tau = 0.18) { this.group.shelves.push(this); }

  /** Add `object` at its resting pose (place it first). */
  add(object: THREE.Object3D, spec: PullSpec): Pullable {
    const p = new Pullable(object, spec);
    this.items.push(p);
    return p;
  }
  /** Link `other` into this shelf's group (before anything is pulled): one item out across both, pairs across both. */
  link(other: Shelf): void {
    if (other.group === this.group) return;
    for (const s of other.group.shelves) { s.group = this.group; this.group.shelves.push(s); }
    for (const [k, v] of other.group.partners) this.group.partners.set(k, v);
  }
  /** Pair two items of this shelf's group: while either is out the other stands half out. */
  pair(a: Pullable, b: Pullable): void { this.group.partners.set(a, b); this.group.partners.set(b, a); }
  /** That item out, its partner half out and every other item of the group back (null: all back). */
  set(item: Pullable | null): void {
    const g = this.group, half = item && g.partners.get(item);
    g.out = item;
    for (const s of g.shelves) for (const p of s.items) p.want = p === item ? 1 : p === half ? HALF : 0;
  }
  /** Put back whatever is out in the group, and its partner; false when nothing is. */
  putBack(): boolean { if (!this.group.out) return false; this.set(null); return true; }
  /** Put `item` back if it is the one out. */
  back(item: Pullable): void { if (this.group.out === item) this.set(null); }
  /** Is `item` the one out? */
  isOut(item: Pullable): boolean { return this.group.out === item; }
  /** A click on `item`: true when it was already out and opens (the caller opens it); otherwise it comes out. */
  pull(item: Pullable): boolean {
    if (this.group.out === item) return item.opens;
    this.set(item);
    return false;
  }
  /** The close-up's line for this shelf as it stands (idle unless the item out is one of its own). */
  hint(): string {
    const o = this.group.out;
    return !o || !this.items.includes(o) ? this.hints.idle : o.opens ? this.hints.open : this.hints.out;
  }
  update(dt: number): void { for (const p of this.items) p.update(dt, this.tau); }

  /** The Equipment members for one item on this shelf: `select` (the camera flies to it: out; leaves: back),
   *  `pull`, `pulled`, `hint` and `out` (how far it is wanted out: 0, HALF or 1; for tests). */
  member(item: Pullable): { select(on: boolean): void; pull(): boolean; pulled(): boolean; hint(): string; out(): number } {
    return {
      select: on => on ? this.set(item) : this.back(item),
      pull: () => this.pull(item),
      pulled: () => this.group.out === item && item.opens,
      hint: () => this.hint(),
      out: () => item.want,
    };
  }
}
