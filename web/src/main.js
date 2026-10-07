// Start-up.
"use strict";
boot().then(() => {
  liveInit(); sceneButtons(); resize(); featInit(); loadReel(P({ scene: 1 })); simInit();
  if (BARE) { document.body.classList.add("still"); resize(); }
  if (STILL) { const tq = /[?&]t=(-?[0-9.]+)/.exec(location.search); track({ playing: false, get: LS.get0 + (tq ? parseFloat(tq[1]) : 70), roll: -3, labLv: 0 }); syncUI(); }
  else openLink();
  roomApply();
  requestAnimationFrame(tick); })
  .catch(e => { $("err").textContent = "Could not start the kernel: " + e.message; console.error(e); });
