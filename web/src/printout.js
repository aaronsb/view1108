// The listing printed again, and as a PDF: deliberate extras, ours.
//
// PRINT FRESH COPY clears the greenbar and prints the kernel listing (listing.js listingPages) again a line at a time,
// at the 1108's high-speed printer's 1,200 lines a minute (UP-4046 rev. 3 sec. 8.5; docs/lab.md) or ten times that.
// A line printer strikes a whole line at once, so lines appear whole, each with its baseline a hair off; the paper
// follows the print line, each sheet's end is a form feed, and the sound is sound.js's printer. In the room the 3D
// printer's paper advances in step (a `print` event per frame, room.js labEvent). Any click, Esc or scroll on the
// paper skips to the end. Then DOWNLOAD PDF (also there any time) writes the listing as a PDF of real continuous-form
// sheets, built here by hand: no library, no compression.
"use strict";
const PRINT_LPM = 1200, PRINT_FAST = 10;
let printFast = false, printJob = null;
const printRate = () => PRINT_LPM / 60 * (printFast ? PRINT_FAST : 1);   // lines a second

function printSheet(paper) {
  const el = document.createElement("div"), pre = document.createElement("pre"); el.className = "pg";
  el.appendChild(pre); paper.appendChild(el);
  return pre;
}
function printFresh() {
  printStop(false);
  const paper = $("paper"), sheets = listingPages();
  paper.replaceChildren(); paper.dataset.built = "1"; paper.scrollTop = 0;
  listingLight = true; applyListing();   // greenbar for this showing (the stored choice is left alone)
  $("bpdf").classList.remove("on");
  printJob = { sheets, s: 0, i: 0, pre: printSheet(paper), t0: performance.now(), done: 0, raf: 0 };
  soundPrintRun(true);
  printJob.raf = requestAnimationFrame(printStep);
}
function printStep(now) {
  const J = printJob;
  if (!J) return;
  const due = Math.floor((now - J.t0) / 1000 * printRate()) - J.done;
  let n = 0;
  for (; n < due && J.s < J.sheets.length; n++) {
    const sheet = J.sheets[J.s], span = document.createElement("span");
    span.textContent = sheet.lines[J.i]; span.style.position = "relative"; span.style.top = ((Math.random() - 0.5) * 1.2).toFixed(2) + "px";
    J.pre.append(span, "\n");
    if (n < 3) soundPrintLine(sndCtx ? sndCtx.currentTime + n / printRate() : 0);
    if (++J.i >= sheet.lines.length) {
      J.i = 0;
      if (++J.s < J.sheets.length) { J.pre = printSheet($("paper")); soundPrintFeed(); }
    }
  }
  J.done += n;
  if (n) {
    labEvent("print", now, n);
    const paper = $("paper"), pg = J.pre.parentElement, y = pg.offsetTop + J.pre.childElementCount * 20;
    paper.scrollTop = Math.max(0, y - paper.clientHeight * 0.7);
  }
  if (J.s >= J.sheets.length) { printStop(true); return; }
  J.raf = requestAnimationFrame(printStep);
}
// Stop printing; `finish` sets the rest of the listing at once (the skip) and offers the PDF.
function printStop(finish) {
  const J = printJob;
  if (!J) return;
  cancelAnimationFrame(J.raf); printJob = null;
  soundPrintRun(false);
  if (!finish) return;
  for (; J.s < J.sheets.length; J.s++, J.i = 0) {
    J.pre.append(J.sheets[J.s].lines.slice(J.i).join("\n") + "\n");
    if (J.s + 1 < J.sheets.length) J.pre = printSheet($("paper"));
  }
  $("bpdf").classList.add("on");
}
const printSkip = () => { if (printJob) printStop(true); };
$("bfresh").onclick = printFresh;
$("bpspeed").onclick = () => { printFast = !printFast; $("bpspeed").textContent = printFast ? "Fast" : "Real"; if (printJob) { printJob.t0 = performance.now() - printJob.done / printRate() * 1000; } };
$("paper").addEventListener("pointerdown", printSkip);
$("paper").addEventListener("wheel", printSkip, { passive: true });
window.addEventListener("keydown", e => { if (e.key === "Escape" && printJob) { e.preventDefault(); e.stopImmediatePropagation(); printSkip(); } }, true);
$("bclose").addEventListener("click", printSkip);

// ---- the PDF ----
// 14 7/8 x 11 in continuous form, the usual stock for 132-column printers (our choice: no source says what MSC's
// printer used), 6 lines and 10 characters to the inch: 66 lines a sheet, 132 columns in 13.2 in. Courier 12 pt sets
// 7.2 pt a character, 10 to the inch. Greenbar bands three lines deep, tractor holes at 1/2 in pitch down both
// 1/2 in margins, a faint perforation along each margin and at each fold. The background is one Form XObject drawn
// on every page. Text is the base-14 Courier, so nothing is embedded.
const PDF_W = 14.875 * 72, PDF_H = 11 * 72, PDF_LINE = 12, PDF_COLS = 132, PDF_CH = 7.2;
const pdfEsc = s => s.replace(/[\\()]/g, c => "\\" + c);
const pdfNum = v => (Math.round(v * 100) / 100).toString();
/** A circle as four Bezier arcs. */
function pdfCircle(x, y, r) {
  const k = r * 0.5523;
  return `${pdfNum(x + r)} ${pdfNum(y)} m ${pdfNum(x + r)} ${pdfNum(y + k)} ${pdfNum(x + k)} ${pdfNum(y + r)} ${pdfNum(x)} ${pdfNum(y + r)} c ` +
    `${pdfNum(x - k)} ${pdfNum(y + r)} ${pdfNum(x - r)} ${pdfNum(y + k)} ${pdfNum(x - r)} ${pdfNum(y)} c ` +
    `${pdfNum(x - r)} ${pdfNum(y - k)} ${pdfNum(x - k)} ${pdfNum(y - r)} ${pdfNum(x)} ${pdfNum(y - r)} c ` +
    `${pdfNum(x + k)} ${pdfNum(y - r)} ${pdfNum(x + r)} ${pdfNum(y - k)} ${pdfNum(x + r)} ${pdfNum(y)} c`;
}
function pdfBackground() {
  const m = 36, out = [];
  out.push("0.835 0.925 0.827 rg");   // the green bands, every other three lines from the top
  for (let l = 3; l < 66; l += 6) out.push(`${m} ${pdfNum(PDF_H - (l + 3) * PDF_LINE)} ${pdfNum(PDF_W - 2 * m)} ${3 * PDF_LINE} re f`);
  out.push("0.92 0.92 0.9 rg 0.62 0.66 0.62 RG 0.5 w");   // tractor holes
  for (let k = 0; k < 22; k++) for (const x of [m / 2, PDF_W - m / 2]) out.push(pdfCircle(x, PDF_H - 18 - k * 36, 5.6) + " b");
  out.push("0.62 0.7 0.62 RG 0.4 w [2 2] 0 d");           // perforations: the margins' tear lines and the fold
  out.push(`${m} 0 m ${m} ${PDF_H} l S ${pdfNum(PDF_W - m)} 0 m ${pdfNum(PDF_W - m)} ${PDF_H} l S`);
  out.push(`0 0.5 m ${pdfNum(PDF_W)} 0.5 l S 0 ${pdfNum(PDF_H - 0.5)} m ${pdfNum(PDF_W)} ${pdfNum(PDF_H - 0.5)} l S`);
  return out.join("\n");
}
/** The listing as PDF text (all ASCII: the listing is FIELDATA's character set, listing.js fieldata). */
function pdfListing() {
  const sheets = listingPages(), objs = [];
  const add = s => { objs.push(s); return objs.length; };
  const stream = (dict, body) => `<< ${dict} /Length ${body.length} >>\nstream\n${body}\nendstream`;
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add(null);   // the page tree, once the pages are known
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>");
  add(stream(`/Type /XObject /Subtype /Form /BBox [0 0 ${pdfNum(PDF_W)} ${PDF_H}]`, pdfBackground()));
  const x0 = (PDF_W - PDF_COLS * PDF_CH) / 2, kids = [];
  for (const s of sheets) {
    const text = s.lines.map(l => `(${pdfEsc(l)}) '`).join("\n");
    // Each line moves down one line and shows; the first baseline sits 9.5 pt into the top line.
    const body = `q /BG Do Q\nBT /F1 12 Tf ${PDF_LINE} TL 0 g ${pdfNum(x0)} ${pdfNum(PDF_H + PDF_LINE - 9.5)} Td\n${text}\nET`;
    const c = add(stream("", body));
    kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfNum(PDF_W)} ${PDF_H}] /Contents ${c} 0 R /Resources << /Font << /F1 3 0 R >> /XObject << /BG 4 0 R >> >> >>`));
  }
  objs[1] = `<< /Type /Pages /Kids [${kids.map(k => k + " 0 R").join(" ")}] /Count ${kids.length} >>`;
  let pdf = "%PDF-1.4\n";
  const at = objs.map((o, i) => { const off = pdf.length; pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; return off; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + at.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("");
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}
$("bpdf").onclick = () => {
  const a = document.createElement("a"), url = URL.createObjectURL(new Blob([pdfListing()], { type: "application/pdf" }));
  a.href = url; a.download = `view1108_listing_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
