// Simulation: fly our own integrated trajectory instead of replaying the sourced one, with or without state vector
// updates. A modern addition in the RESTOMOD spirit: VIEW drew pre-flight predictions (TN D-6853, p. 3); this engine
// integrates our own trajectory. The Simulation group appears only when the kernel exports sim_run.
"use strict";
// Every kernel access for the simulation is in SIMK, so a change in the kernel interface is a change here only
// (contract in CLAUDE.md; engine in docs/simulation.md). sim_run(flags) fills the tape, bit 0 = state vector updates
// on; in_flags bit 3 draws the CSM from the tape where it covers the time (before TLI the kernel falls back to the
// replay); hdr(17) the source used this frame (0 replay, 1 sim with updates, 2 sim free, 3 a tape read from the deck,
// src/vdktap.f: the page loads none yet, #26 slice 7), hdr(18) and hdr(19) the
// position (km) and velocity (ft/s) error at the reference row nearest GET, hdr(20) that row's GET.
const SIM_FLAG = 8;
const SIMK = {
  present: () => !!K && typeof K.sim_run === "function",
  run: svu => { soundTape(); labEvent("tape"); return K.sim_run(svu ? 1 : 0); },
  flags: sim => sim ? SIM_FLAG : 0,   // ORed into in_flags every frame (loop.js)
  // Re-mount the scene with the new source, keeping time and look, so a running simulation re-fills its tape
  // (simAfterInit). The scene's defaults and aim are the replay's whatever the source (vdrive.f VINIT).
  reinit: sim => {
    wi("in_flags", (ri("in_flags") & ~SIM_FLAG) | (sim ? SIM_FLAG : 0));
    loadReel(P({ by: "source" }));
  },
  readout: () => { const H = new Float64Array(buf(), K.hdr.value, 24); return { src: H[16] | 0, perr: H[17], verr: H[18], rget: H[19] }; }
};
let simOn = false, simSvu = true, simAvail = false;
function simSet(on, svu) {
  simOn = on; simSvu = svu;
  SIMK.reinit(simOn);   // re-fills the tape too when simulating (simAfterInit)
  $("ssrc-replay").classList.toggle("on", !simOn); $("ssrc-sim").classList.toggle("on", simOn);
  $("ssvu").classList.toggle("on", simSvu); $("ssvu").textContent = "State vector updates " + (simSvu ? "on" : "off");
}
// After every view_init while simulating: the tape belongs to the scene's scenario (about 18 ms a run).
function simAfterInit() { if (simAvail && simOn) SIMK.run(simSvu); }
const simFlags = () => simAvail ? SIMK.flags(simOn) : 0;
function simTick() {
  if (!simAvail) return;
  const r = SIMK.readout();
  const t = !simOn ? "SOURCE REPLAY" : r.src === 0 ? "SIM - BEFORE TLI, REPLAY" : r.src === 3 ? "TAPE - FROM THE DECK" :
    (r.src === 1 ? "SIM - UPDATES ON" : "SIM - FREE") +
    (r.rget ? `   ERR ${r.perr.toFixed(1)} KM ${r.verr.toFixed(1)} FT/S   VS ${getStr(r.rget)}` : "");
  const el = $("simread"); if (el.textContent !== t) el.textContent = t;
}
// After boot: show the group if the kernel has the engine, then apply ?traj=sim&svu=0|1.
function simInit() {
  simAvail = SIMK.present();
  $("simgrp").hidden = !simAvail;
  if (!simAvail) return;
  $("ssrc-replay").onclick = () => simSet(false, simSvu);
  $("ssrc-sim").onclick = () => simSet(true, simSvu);
  $("ssvu").onclick = () => simSet(simOn, !simSvu);
  simSet(UP.get("traj") === "sim", UP.get("svu") !== "0");
}
