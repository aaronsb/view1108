// A modal question (ours; #19, the operator's reel and notebook modals of 2026-10-07): a title and a row of buttons
// over everything, the page's overlay style. room.js asks it for the lab (hooks.ask): a pulled reel's LOAD NEW
// SIMULATION SCENARIO? and a pulled mission notebook's LOAD SIMULATION AND REVIEW NOTEBOOK?; reels.js asks it for
// Tabbed's reel list (#73), its buttons stacked. Built from DOM nodes only.
// Open, it is on the Esc stack as "ask" (esc.js), and Esc does its `back` (put the tape or notebook back). Keys: Enter
// presses the focused button (the primary one has focus when it opens), Tab and Shift+Tab move between the buttons
// only, and no other key reaches anything behind it (the room's walking keys among them): its listener is a capture
// listener on the window, added before the room's. Closed, it gives the focus back: to the room's canvas while the
// room is shown, else to what had it.
"use strict";
let askOn = null;   // the open question: { back, prev }, prev what had the focus
/** Ask `title` with `actions` ([{ label, run, primary, cls, title, data }], the primary first gets focus; cls a class,
 *  title a tooltip, data dataset entries); `back` is what Esc does. layout "list" stacks the buttons, one per line
 *  (Tabbed's reel list, reels.js). */
function askOpen(title, actions, back, layout = "") {
  askClose();
  const btns = $("askbtns");
  $("asktitle").textContent = title; btns.textContent = "";
  $("ask").classList.toggle("list", layout === "list");
  for (const a of actions) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = a.label;
    if (a.primary) b.classList.add("primary");
    if (a.cls) b.classList.add(a.cls);
    if (a.title) b.title = a.title;
    Object.assign(b.dataset, a.data || {});
    b.onclick = () => { askClose(); a.run(); };
    btns.appendChild(b);
  }
  askOn = { back, prev: document.activeElement };
  $("ask").hidden = false;
  escPush("ask", () => { askClose(); back(); });
  (btns.querySelector("button.primary") || btns.firstChild)?.focus();
}
function askClose() {
  if (!askOn) return;
  const prev = askOn.prev;
  askOn = null; $("ask").hidden = true; escDrop("ask");
  const to = document.body.classList.contains("room") ? $("labhost").querySelector("canvas") : prev;
  if (to && to.tagName === "CANVAS" && !to.hasAttribute("tabindex")) to.setAttribute("tabindex", "-1");   // focusable, not tabbed to
  if (to && to !== document.body && to.focus) to.focus({ preventScroll: true });
}
window.addEventListener("keydown", e => {
  if (!askOn || e.key === "Escape") return;   // Escape: esc.js, whose top entry is "ask"
  const bs = [...$("askbtns").children], i = bs.indexOf(document.activeElement);
  e.stopImmediatePropagation();
  if (e.key === "Tab") { e.preventDefault(); bs[(i + (e.shiftKey ? -1 : 1) + bs.length) % bs.length].focus(); }
  else if (e.key === "Enter") { e.preventDefault(); (bs[i] || bs.find(b => b.classList.contains("primary")) || bs[0]).click(); }
  else if (e.key !== " " || i < 0) e.preventDefault();   // Space presses a focused button, as a button's own key
}, true);
