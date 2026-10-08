// The one Esc stack (docs/systems-model.md, section 6; #20). Opening something pushes it with what Esc does while it is
// on top; Esc does what the top entry says, and that entry's closer takes it off (escDrop), whichever way it closed
// (Esc, its own Close or ← Room button, the room's flight back). Pushing a key already on the stack moves it to the top
// with its new action. Nothing on the stack touches the loaded state (rule 2). Entries stack in the order things open, so
// from top to bottom the order is:
//   printing  a fresh copy printing (printout.js): Esc finishes it at once
//   library   the reference library (library.js): Esc closes it; opened from the bookcase (room.js), back to the bookcase
//   listing   the listing overlay (listing.js): Esc closes it; opened from the line printer (room.js), back to the printer
//   terminal  a terminal's page in the room (room.js): Esc fades back to the room, in front of that terminal
//   pulled    in the room, a binder pulled out at the bookcase's close-up, or a reel at the tape rack's, which stays
//             while it is carried to a tape unit (web/lab lab.ts): Esc puts it back
//   closeup   in the room, a terminal's close-up (lab.ts): Esc steps back to stand in front of it
//   room      the room itself, at the bottom while it runs (room.js, escBase): Esc walks back to the overview
// (A terminal's page and its close-up never stand together: the room is hidden while the page shows.)
// Source's own overlays (srcview.js) and Fusion's alignment (fusion.js) take Esc before the stack; so does the pointer
// lock (escGuard: the browser's Esc releases it, and the room swallows that Esc if the page sees it). A key typed into a
// text field is the field's.
"use strict";
const escStack = [];   // { key, pop }, top last
let escGuard = () => false;
function escPush(key, pop) { escDrop(key); escStack.push({ key, pop }); }
function escBase(key, pop) { escDrop(key); escStack.unshift({ key, pop }); }
function escDrop(key) { const i = escStack.findIndex(x => x.key === key); if (i >= 0) escStack.splice(i, 1); }
window.addEventListener("keydown", e => {
  if (e.key !== "Escape" || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || typingIn()) return;
  if (escGuard()) { e.preventDefault(); return; }
  const top = escStack[escStack.length - 1];
  if (!top) return;
  e.preventDefault(); top.pop();
});
if (DEBUG) window.VIEW_ESC = () => escStack.map(x => x.key);   // test hook: the stack, bottom first
