// Dev-only stand-in for the FORTRAN wasm kernel. Implements the shell contract
// (view_init, view_frame, WebAssembly.Global-like offsets, memory) with a toy scene.
// Loaded by page.template.html when opened with ?mock or when the wasm placeholder is unfilled.
window.MOCK_NAMES = {
  NAV: ["ALPHERATZ", "DIPHDA", "NAVI", "ACHERNAR", "POLARIS", "ACAMAR", "MENKAR", "MIRFAK"],
  CRATER: ["Hertzsprung", "Apollo", "Korolev", "Lorentz", "Poincare", "Harkhebi"]
};

function VIEW1108_MOCK() {
  const memory = new WebAssembly.Memory({ initial: 64 });
  const G = v => ({ value: v });
  const O = {
    in_get: 64, in_yaw: 72, in_pitch: 80, in_roll: 88, in_fov: 96, in_flags: 104,
    hdr: 256, nvec: 512, nstar: 516, nlab: 520, sbuf: 1024, lbuf: 100000, vbuf: 110000
  };
  const ex = { memory };
  for (const k in O) ex[k] = G(O[k]);
  const f64 = (o, n) => new Float64Array(memory.buffer, o, n);
  const i32 = o => new Int32Array(memory.buffer, o, 1);

  const SCN = {
    1: { get: 75 * 3600 + 55 * 60 - 60, fov: 12, name: "Earthrise" },
    2: { get: 5 * 3600, fov: 40, name: "Translunar" },
    3: { get: 2 * 3600, fov: 60, name: "Limb" },
    4: { get: 100 * 3600, fov: 30, name: "LM" },
    5: { get: 102 * 3600, fov: 100, name: "Descent" }
  };
  let scene = 1, g0 = 0;

  ex.view_init = s => {
    scene = SCN[s] ? s : 1; g0 = SCN[scene].get;
    f64(O.in_get, 1)[0] = g0; f64(O.in_yaw, 1)[0] = 0; f64(O.in_pitch, 1)[0] = 0;
    f64(O.in_roll, 1)[0] = 0; f64(O.in_fov, 1)[0] = SCN[scene].fov;
    new Int32Array(memory.buffer, O.in_flags, 1)[0] = 3;
  };

  ex.view_frame = () => {
    const get = f64(O.in_get, 1)[0], yaw = f64(O.in_yaw, 1)[0], pit = f64(O.in_pitch, 1)[0];
    const roll = f64(O.in_roll, 1)[0] * Math.PI / 180, fov = f64(O.in_fov, 1)[0];
    const flags = new Int32Array(memory.buffer, O.in_flags, 1)[0];
    const V = f64(O.vbuf, 60000 * 5), S = f64(O.sbuf, 4000 * 3), L = f64(O.lbuf, 200 * 4);
    let nv = 0, ns = 0, nl = 0;
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const P = (az, el) => { const dx = az - yaw, dy = el - pit; return [dx * cr + dy * sr, -dx * sr + dy * cr]; };
    const seg = (a, b, st) => { if (nv < 59999) { V[nv * 5] = a[0]; V[nv * 5 + 1] = a[1]; V[nv * 5 + 2] = b[0]; V[nv * 5 + 3] = b[1]; V[nv * 5 + 4] = st; nv++; } };
    const h = fov / 2;

    if (flags & 2) {
      const c = [[-h, -h], [h, -h], [h, h], [-h, h], [-h, -h]];
      for (let i = 0; i < 4; i++) seg(c[i], c[i + 1], 1);
      const step = fov <= 40 ? 1 : 2, tk = fov * 0.015;
      for (let v = Math.ceil(-h / step) * step; v <= h; v += step) {
        seg([v, -h], [v, -h + tk], 1); seg([-h, v], [-h + tk, v], 1);
        seg([v, h], [v, h - tk], 1); seg([h, v], [h - tk, v], 1);
      }
    }
    // stars
    let r = 12345; const rnd = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 300; i++) {
      const az = (rnd() - .5) * 140, el = (rnd() - .5) * 90, m = rnd() * 6 - 1;
      const p = P(az, el);
      if (Math.abs(p[0]) < h * 1.2 && Math.abs(p[1]) < h * 1.2 && ns < 3999) { S[ns * 3] = p[0]; S[ns * 3 + 1] = p[1]; S[ns * 3 + 2] = m; ns++; }
      if (i < 8 && Math.abs(p[0]) < h && Math.abs(p[1]) < h) { L[nl * 4] = p[0]; L[nl * 4 + 1] = p[1]; L[nl * 4 + 2] = 1; L[nl * 4 + 3] = i + 1; nl++; }
    }
    // horizon
    const hz = -4;
    seg(P(-90, hz), P(90, hz), 1); seg(P(-90, hz - .25), P(90, hz - .25), 1);
    // craters as ellipses under the horizon
    for (let i = 0; i < 40; i++) {
      const az = (rnd() - .5) * 80, d = 0.3 + rnd() * 3, el = hz - 0.4 - d * 0.6 - rnd() * 8, rx = d, ry = d * 0.28 * (1 + (hz - el) * 0.05);
      let prev = null;
      for (let k = 0; k <= 24; k++) {
        const a = k / 24 * 2 * Math.PI, p = P(az + rx * Math.cos(a), el + ry * Math.sin(a));
        if (prev) seg(prev, p, 1); prev = p;
      }
      if (i < 6) { const c = P(az, el); L[nl * 4] = c[0]; L[nl * 4 + 1] = c[1]; L[nl * 4 + 2] = 2; L[nl * 4 + 3] = i; nl++; }
    }
    // Earth rising: 4 deg radius disc, hatched on the lower (night) half
    const eel = hz - 6 + 0.06 * (get - g0), eaz = 3, er = 4, ec = P(eaz, eel);
    let prev = null;
    for (let k = 0; k <= 48; k++) {
      const a = k / 48 * 2 * Math.PI, p = P(eaz + er * Math.cos(a), eel + er * Math.sin(a));
      if (prev) seg(prev, p, 1); prev = p;
    }
    for (let k = 0; k < 14; k++) {
      const x = -er + (k + .5) * 2 * er / 14, y = -Math.sqrt(er * er - x * x) * 0.98;
      const yt = Math.min(0, Math.sqrt(er * er - x * x)) ;
      seg(P(eaz + x, eel + y), P(eaz + x, eel + Math.max(-0.2, -0.2)), 1);
      void yt;
    }
    seg(P(eaz - er, eel - 0.2), P(eaz + er, eel - 0.2), 2);
    L[nl * 4] = ec[0]; L[nl * 4 + 1] = ec[1] + er; L[nl * 4 + 2] = 4; L[nl * 4 + 3] = 0; nl++;
    const sp = P(-20, 25); S[ns * 3] = sp[0]; S[ns * 3 + 1] = sp[1]; S[ns * 3 + 2] = -4; ns++;
    L[nl * 4] = sp[0]; L[nl * 4 + 1] = sp[1]; L[nl * 4 + 2] = 3; L[nl * 4 + 3] = 0; nl++;

    i32(O.nvec)[0] = nv; i32(O.nstar)[0] = ns; i32(O.nlab)[0] = (flags & 1) ? nl : 0;
    const H = f64(O.hdr, 16);
    H[0] = get; H[1] = fov; H[2] = 999; H[3] = 70; H[4] = 5399; H[5] = 2; H[6] = scene; H[7] = 1;
  };
  return ex;
}
