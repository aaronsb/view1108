// The site reel index as a reel list (#19; docs/systems-model.md, sections 1 and 6): one entry per packaged reel
// (kernel.js REEL_LIB, in load order), from its manifest. Both presentations mount a reel with the same params through
// loadReel: in Tabbed the reel list, a modal (ask.js) with a button per reel (its title and kind), and in the room the
// tape rack, whose reels the reel modal or a tape unit mounts (room.js, the lab's hooks.mount). The sim panel's one
// [ RETURN TO REELS ] button (#73) goes to the shelf: in the room the camera flies to the rack (room.js roomToRack), in
// Tabbed the reel list opens. Mounting a scenario reel is a fresh run
// (loader.js loadMount, by=mount; the operator, 2026-10-07): its first situation at its defaults, Free-look, the clock
// stopped, nothing of the last run kept; the sim controls start it. A playlist reel plays, as its mode button does.
// Which reel is mounted: the playlist while one plays, else the situation's scenario reel. A reel that carries a
// scenario notebook (#29) has a "Read the notebook" button after it in the list, opening the library's notebook viewer
// (library.js), whose "Load this reel" mounts it here; in the room its notebook stands on the bookcase.
"use strict";
// The index the room gets (web/lab types.ts ReelInfo): id, title, kind, a scenario reel's mission and range zero
// (UTC ms; its page.json), from which the rack letters its shelves, and its notebook's title, if it carries one.
function reelIndex() {
  return REEL_LIB.map(({ manifest: m, notebook }) => {
    const s = SCNS[m.id];
    return { id: m.id, title: m.title || m.id.toUpperCase(), kind: m.kind, mission: (m.mission && m.mission.name) || (s && s.mission) || "", zero: s && s.zero ? s.zero : null,
      notebook: notebook ? nbTitle(notebook.text) || `${m.title} notebook` : null };
  });
}
function reelMounted() { return auto() ? LS.reel : LS.scn; }
// The params that mount reel `id` (null for a reel the page does not know).
function reelParams(id) {
  const r = REEL_LIB.find(x => x.manifest.id === id);
  if (!r) return null;
  if (r.manifest.kind === "playlist") return REELS[id] ? P({ reel: id }) : null;
  const s = SITS.find(x => x.reel === id);
  return s ? P({ by: "mount", scene: s.scene }) : null;
}
// Mounting the reel already mounted does nothing (it would rewind it to its first situation, or restart a playlist).
function reelMount(id) { if (id === reelMounted()) return; const p = reelParams(id); if (p) { loadReel(p); syncUI(); } }
// Tabbed's reel list: the modal, one row per reel of the index, the mounted one marked and focused (Enter on it changes
// nothing), each reel with a notebook followed by Read the notebook; Esc or Back leaves the run as it was.
function reelListOpen() {
  const acts = [], mounted = reelMounted();
  for (const r of reelIndex()) {
    acts.push({ label: `${r.title} ${r.kind}${r.id === mounted ? " (mounted)" : ""}`, primary: r.id === mounted, data: { reel: r.id },
      title: `Mount the ${r.title} reel (${r.kind}), as the room's tape rack does`, run: () => reelMount(r.id) });
    if (r.notebook) acts.push({ label: "Read the notebook", cls: "reelnb", data: { nb: r.id },
      title: `${r.notebook}: the reel's scenario notebook (ours), in the library`, run: () => libraryOpen("nb-" + r.id) });
  }
  acts.push({ label: "Back to the simulation", cls: "reelback", run: () => {} });
  askOpen("TAPE SHELF: MOUNT A REEL", acts, () => {}, "list");
}
/** [ RETURN TO REELS ]: the room's rack, or Tabbed's reel list. */
function reelsReturn() { if (roomIn) roomToRack(undefined, true); else reelListOpen(); }
$("breels").onclick = reelsReturn;
