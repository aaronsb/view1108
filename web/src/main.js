// Start-up.
"use strict";
boot().then(() => {
  resize(); setScene(1); simInit();
  if (BARE) { document.body.classList.add("still"); resize(); }
  if (STILL) { const tq = /[?&]t=(-?[0-9.]+)/.exec(location.search); playing = false; get = get0 + (tq ? parseFloat(tq[1]) : 70); roll = -3; labels = false; syncUI(); }
  else applyParams();
  requestAnimationFrame(tick); })
  .catch(e => { $("err").textContent = "Could not start the kernel: " + e.message; console.error(e); });
