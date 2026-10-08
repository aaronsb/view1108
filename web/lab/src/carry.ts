// The reel carried from the tape rack (#19): which piece is out, the Esc entry that puts it back, and the tape units
// that mount it when used. lab.ts owns one; it passes the parts of itself that a mount touches (hover and the UI).
import type { LabHooks, Placed, ReelInfo, Room } from "./types";

const MOUNT_MS = 400;               // after a mount, a tape unit's own use (the drive's STOP/START) waits this long

export class Carry {
  /** When a carried reel was last mounted (performance.now()), for MOUNT_MS. */
  private mountT = -Infinity;

  constructor(private room: Room, private hooks: LabHooks, private after: { clearHover(): void; lockUI(): void }) {
    // Every tape unit mounts a reel carried from the rack; without one, the drive is still STOP/START and the others
    // do nothing (and are not picked).
    for (const p of room.placed) if (p.equipment.anchors.tapeUnit !== undefined) {
      const own = p.equipment.use;
      // A double click mounts with its first click; its second must not then stop the clock (MOUNT_MS).
      p.equipment.use = () => { const r = this.carried(); if (r) this.mount(r); else if (performance.now() - this.mountT > MOUNT_MS) own?.(); };
      p.equipment.usable = () => !!own || !!this.carried();
    }
  }

  /** The reel pulled at the tape rack and carried from it, if any. */
  carried(): Placed | undefined {
    return this.room.placed.find(p => p.equipment.carried?.());
  }

  /** A carried reel used on a tape unit: the page mounts it (loadReel), and it goes back on the rack. */
  private mount(reel: Placed): void {
    this.mountT = performance.now();
    reel.equipment.putBack?.();
    this.hooks.esc?.("pulled", null);
    this.hooks.mount?.(reel.name.replace(/^reel:/, ""));
    this.after.clearHover(); this.after.lockUI();
  }

  /** At a close-up something was pulled out (a binder, a reel): on the Esc stack as "pulled", Esc puts it back. */
  pulledOut(): void {
    this.hooks.esc?.("pulled", () => {
      for (const p of this.room.placed) if (p.equipment.putBack?.()) break;
      if (this.carried()) this.pulledOut(); else this.hooks.esc?.("pulled", null);   // a binder went back; the reel next
      this.after.lockUI();
    });
    this.after.lockUI();
  }

  /** A reel piece's title (taperack.ts ReelPiece). */
  reelTitle(p: Placed): string {
    return (p.equipment as { reel?: ReelInfo }).reel?.title ?? p.name;
  }
}
