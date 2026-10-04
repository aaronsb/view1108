// Window shades: each control group's header shows or hides the group. The viewer's choice per group is remembered;
// until one is made, a narrow screen opens only each tab's own groups and Look, and a wide one opens them all.
"use strict";
const SHADES_KEY = "view1108.shades", SHADES_NARROW = ["mode", "live", "beam", "film", "fusion", "look"];
const shadeOpen = {};
try { Object.assign(shadeOpen, JSON.parse(localStorage.getItem(SHADES_KEY) || "{}")); } catch (e) { /* storage unavailable */ }
const narrow = matchMedia("(max-width: 600px)").matches;
document.querySelectorAll("#ctl .shade").forEach(sec => {
  const id = sec.dataset.shade, h = sec.querySelector(".shade-h");
  const set = open => { sec.classList.toggle("shut", !open); h.setAttribute("aria-expanded", String(open)); };
  set(id in shadeOpen ? !!shadeOpen[id] : !narrow || SHADES_NARROW.includes(id));
  h.onclick = () => {
    const open = sec.classList.contains("shut"); set(open); shadeOpen[id] = open;
    try { localStorage.setItem(SHADES_KEY, JSON.stringify(shadeOpen)); } catch (e) { /* ignore */ }
  };
});
