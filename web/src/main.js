// Start-up.
"use strict";
boot().then(() => {
  resize(); featInit(); setScene(SITS[0].id); simInit();
  if (BARE) { document.body.classList.add("still"); resize(); }
  if (STILL) { const tq = /[?&]t=(-?[0-9.]+)/.exec(location.search); LS.playing = false; LS.get = LS.get0 + (tq ? parseFloat(tq[1]) : 70); LS.roll = -3; LS.labLv = 0; syncUI(); }
  else { applyParams(); fusionParams(); }
  roomApply();
  requestAnimationFrame(tick); })
  .catch(e => { $("err").textContent = "Could not start the kernel: " + e.message; console.error(e); });
