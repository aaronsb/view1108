// The site reel index as a reel list (#19; docs/systems-model.md, sections 1 and 6): one entry per packaged reel
// (kernel.js REEL_LIB, in load order), from its manifest. Both presentations mount a reel with the same params through
// loadReel: in Tabbed the Reels group, a button per reel (its title and kind), and in the room the tape rack, whose
// reels a tape unit mounts (room.js, the lab's hooks.mount). A scenario reel mounts its first situation as a viewer's
// pick would (loader.js pickSituation: Free-look, a Live pin, or Beam stays); a playlist reel plays, as its mode
// button does. Which reel is mounted: the playlist while one plays, else the situation's scenario reel. A reel that
// carries a scenario notebook (#29) has a "Read the notebook" button after it, opening the library's notebook viewer
// (library.js), whose "Load this reel" mounts it here; in the room its binder stands beside it on the rack.
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
  return s ? P({ scene: s.scene }) : null;
}
// Mounting the reel already mounted does nothing (it would rewind it to its first situation, or restart a playlist).
function reelMount(id) { if (id === reelMounted()) return; const p = reelParams(id); if (p) { loadReel(p); syncUI(); } }
// Tabbed's Reels group, built once the page's data is set at boot (main.js); syncUI marks the mounted one.
function reelButtons() {
  const g = $("reels"), list = reelIndex();
  g.closest(".shade").hidden = !list.length;
  for (const r of list) {
    const b = document.createElement("button"), t = document.createElement("span"), k = document.createElement("small");
    b.type = "button"; b.dataset.reel = r.id; t.textContent = r.title; k.textContent = r.kind;
    b.title = `Mount the ${r.title} reel (${r.kind}), as the room's tape rack does`;
    b.append(t, " ", k); b.onclick = () => reelMount(r.id);
    g.appendChild(b);
    if (!r.notebook) continue;
    const nb = document.createElement("button");
    nb.type = "button"; nb.className = "reelnb"; nb.dataset.nb = r.id; nb.textContent = "Read the notebook";
    nb.title = `${r.notebook}: the reel's scenario notebook (ours), in the library`;
    nb.onclick = () => libraryOpen("nb-" + r.id);
    g.appendChild(nb);
  }
}
