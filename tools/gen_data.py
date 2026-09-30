#!/usr/bin/env python3
"""Generate src/viewdata.f (BLOCK DATA), src/viewdims.inc and build/names.js from data/.

Inputs (all in data/):
  Comanche055_STAR_TABLES.agc   the 37 Apollo nav stars as AGC unit vectors (1969.5 epoch)
  stars.6.json                  d3-celestial star catalog (J2000 RA/Dec, V mag)
  ne_110m_coastline.geojson     Natural Earth 1:110m coastlines
  MOON_nomenclature_center_pts.dbf   IAU lunar gazetteer (crater centres and diameters)
  scenarios/*.scn               scenarios (run decks): epoch, trajectory legs, events
  meeus47.txt                   Meeus ch. 47 lunar periodic terms (tables 47.A and 47.B)

Everything is written in the J2000 equatorial frame. AGC star vectors are precessed
from 1969.5 to J2000 so they share a frame with the catalog.
"""
import json, math, pathlib, re, shlex, struct

R = pathlib.Path(__file__).resolve().parent.parent
D = R / "data"

NAV_NAMES = ["ALPHERATZ", "DIPHDA", "NAVI", "ACHERNAR", "POLARIS", "ACAMAR", "MENKAR",
             "MIRFAK", "ALDEBARAN", "RIGEL", "CAPELLA", "CANOPUS", "SIRIUS", "PROCYON",
             "REGOR", "ALPHARD", "REGULUS", "DNOCES", "DENEBOLA", "GIENAH", "ACRUX", "SPICA",
             "ALKAID", "MENKENT", "ARCTURUS", "ALPHECCA", "ANTARES", "ATRIA", "RASALHAGUE",
             "VEGA", "NUNKI", "ALTAIR", "DABIH", "PEACOCK", "DENEB", "ENIF", "FOMALHAUT"]
STAR_MAG = 4.5          # background stars down to this visual magnitude (TN D-6853)
CRATER_MIN_KM = 4.0     # smallest crater kept from the gazetteer


def precess_matrix(t):
    """IAU 1976 precession from J2000 to epoch J2000 + t Julian centuries."""
    a = math.radians
    zeta = a((2306.2181 * t + 0.30188 * t * t + 0.017998 * t ** 3) / 3600)
    z = a((2306.2181 * t + 1.09468 * t * t + 0.018203 * t ** 3) / 3600)
    th = a((2004.3109 * t - 0.42665 * t * t - 0.041833 * t ** 3) / 3600)
    cz, sz, cZ, sZ, ct, st = map(lambda f: f, (math.cos(zeta), math.sin(zeta), math.cos(z),
                                               math.sin(z), math.cos(th), math.sin(th)))
    return [[cz * ct * cZ - sz * sZ, -sz * ct * cZ - cz * sZ, -st * cZ],
            [cz * ct * sZ + sz * cZ, -sz * ct * sZ + cz * cZ, -st * sZ],
            [cz * st, -sz * st, ct]]


def nav_stars():
    txt = (D / "Comanche055_STAR_TABLES.agc").read_text()
    vec = {}
    for m in re.finditer(r"2DEC\s+([+-]?\.\d+)\s+B-1\s+#\s*STAR\s+(\d+)\s*([XYZ])", txt):
        vec.setdefault(int(m.group(2)), {})[m.group(3)] = float(m.group(1))
    p = precess_matrix(-0.305)                      # 1969.5 -> 2000.0
    out = []
    for n in range(1, 38):
        v = [vec[n][k] for k in "XYZ"]
        w = [sum(p[j][i] * v[j] for j in range(3)) for i in range(3)]   # transpose = inverse
        s = math.sqrt(sum(c * c for c in w))
        out.append([c / s for c in w])
    return out


def unit(ra, de):
    ra, de = math.radians(ra), math.radians(de)
    return [math.cos(de) * math.cos(ra), math.cos(de) * math.sin(ra), math.sin(de)]


def catalog_stars(nav):
    js = json.loads((D / "stars.6.json").read_text())
    stars, navmag = [], [9.0] * 37
    for f in js["features"]:
        mag = f["properties"]["mag"]
        ra, de = f["geometry"]["coordinates"]
        u = unit(ra % 360, de)
        best = max(range(37), key=lambda i: sum(a * b for a, b in zip(u, nav[i])))
        if sum(a * b for a, b in zip(u, nav[best])) > math.cos(math.radians(0.2)):
            navmag[best] = min(navmag[best], mag)      # this catalog star is a nav star
            continue
        if mag <= STAR_MAG:
            stars.append((u, mag))
    return stars, navmag


def coastlines():
    js = json.loads((D / "ne_110m_coastline.geojson").read_text())
    lines = []
    for f in js["features"]:
        g = f["geometry"]
        parts = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]
        lines += [p for p in parts if len(p) >= 2]
    return lines


def maria():
    """Mare, lacus, sinus and oceanus centres and diameters from the gazetteer."""
    out = [r for r in gazetteer() if r["code"] in ("ME", "LC", "SI", "OC")]
    res = []
    for r in out:
        lon = float(r["center_lon"])
        lon = lon - 360 if lon > 180 else lon
        res.append((float(r["center_lat"]), lon, float(r["diameter"]), r["clean_name"].upper()))
    res.sort(key=lambda m: -m[2])
    return res


def gazetteer():
    f = open(D / "MOON_nomenclature_center_pts.dbf", "rb")
    h = f.read(32)
    n, hl, rl = struct.unpack("<IHH", h[4:12])
    fields = []
    while True:
        d = f.read(32)
        if d[0] == 0x0D:
            break
        fields.append((d[:11].split(b"\0")[0].decode(), d[16]))
    f.seek(hl)
    recs = []
    for _ in range(n):
        r = f.read(rl)
        o, rec = 1, {}
        for nm, ln in fields:
            rec[nm] = r[o:o + ln].decode("utf8", "replace").strip()
            o += ln
        recs.append(rec)
    return recs


def craters():
    f = open(D / "MOON_nomenclature_center_pts.dbf", "rb")
    h = f.read(32)
    n, hl, rl = struct.unpack("<IHH", h[4:12])
    fields = []
    while True:
        d = f.read(32)
        if d[0] == 0x0D:
            break
        fields.append((d[:11].split(b"\0")[0].decode(), d[16]))
    f.seek(hl)
    out = []
    for _ in range(n):
        r = f.read(rl)
        o, rec = 1, {}
        for nm, ln in fields:
            rec[nm] = r[o:o + ln].decode("utf8", "replace").strip()
            o += ln
        if rec["code"] not in ("AA", "SF"):          # craters and satellite craters
            continue
        dia = float(rec["diameter"])
        if dia < CRATER_MIN_KM:
            continue
        lon = float(rec["center_lon"])
        lon = lon - 360 if lon > 180 else lon
        out.append((float(rec["center_lat"]), lon, dia, rec["clean_name"], rec["code"]))
    out.sort(key=lambda c: -c[2])
    return out


# Scenarios (run decks).  Codes shared with the kernel through viewdims.inc.
LEG_TYPES = {"CIRC": 1, "CONIC": 2, "LUNAR": 3}
EVENT_KINDS = {"TDATT": 1, "SEP": 2, "APPR": 3, "DOCK": 4, "UNDOCK": 5, "TOUCH": 6, "EI": 7,
               "PTC": 8}
EVENT_PARAMS = {"TDATT": "KETDA", "SEP": "KESEP", "APPR": "KEAPR", "DOCK": "KEDOK",
                "UNDOCK": "KEUND", "TOUCH": "KETD", "EI": "KEEI", "PTC": "KEPTC"}
NLGP = 12   # leg parameters, see scenarios()
# Keys each card type reads.  Other keys are ignored with a warning, so cards can grow
# (a BURN's TRIGGER= and TARGET= are planned, docs/simulation.md) without breaking old decks.
CARD_KEYS = {
    "SCENARIO": {"ID", "MISSION", "NAME", "SRC"},
    "EPOCH": {"JD", "SRC"},
    "SITE": {"LAT", "LON", "AZ", "SRC"},
    "LEG": {"TYPE", "FROM", "TO", "T", "LATTYPE", "LAT", "LON", "ALT", "V", "FPA", "HDG",
            "TB", "LATB", "LONB", "N", "SRC"},
    "EVENT": {"KIND", "T", "SRC"},
    "START": {"T", "END", "BODY", "LATTYPE", "LAT", "LON", "ALT", "V", "FPA", "HDG", "SRC"},
    "REF": {"T", "BODY", "LATTYPE", "LAT", "LON", "ALT", "V", "FPA", "HDG", "SRC"},
    "BURN": {"T", "DV", "BODY", "P", "R", "N", "SRC"},
}


def get_s(v):
    """g.e.t. h:mm:ss.s (or plain seconds) to seconds."""
    if ":" not in v:
        return float(v)
    h, m, x = v.split(":")
    return int(h) * 3600 + int(m) * 60 + float(x)


def scenarios():
    """Parse data/scenarios/*.scn.  Returns scenarios (dicts with id, mission, name, jd,
    site, sources), legs and events, each carrying its scenario id and source string."""
    mis, legs, evs, sim = [], [], [], {"start": [], "burn": [], "ref": []}
    for path in sorted((D / "scenarios").glob("*.scn")):
        cur = None
        for ln in path.read_text().splitlines():
            if not ln.strip() or ln.startswith("*"):
                continue
            tok = shlex.split(ln)
            kind, kv = tok[0], dict(t.split("=", 1) for t in tok[1:])
            if kind not in CARD_KEYS:
                print(f"warning: {path.name}: unknown card {kind}, ignored")
                continue
            for k in sorted(set(kv) - CARD_KEYS[kind]):
                print(f"warning: {path.name}: {kind} card: unknown key {k}, ignored")
            if kind == "SCENARIO":
                cur = {"n": int(kv["ID"]), "name": kv["MISSION"] + " " + kv["NAME"], "jd": None,
                       "site": (0.0, 0.0, 0.0), "src": []}
                mis.append(cur)
            elif kind == "EPOCH":
                cur["jd"] = float(kv["JD"]); cur["src"].append("EPOCH: " + kv.get("SRC", ""))
            elif kind == "SITE":
                cur["site"] = (float(kv["LAT"]), float(kv["LON"]), float(kv["AZ"]))
                cur["src"].append("SITE: " + kv.get("SRC", ""))
            elif kind == "LEG":
                t = kv["TYPE"]
                p = [get_s(kv["FROM"]), get_s(kv["TO"]), get_s(kv["T"]),
                     float(kv["LAT"]), float(kv["LON"]), float(kv["ALT"]),
                     float(kv.get("V", 0)), float(kv.get("FPA", 0)), float(kv.get("HDG", 0)),
                     get_s(kv.get("TB", "0")), float(kv.get("LATB", 0)), float(kv.get("LONB", 0))]
                legs.append({"m": cur["n"], "type": LEG_TYPES[t], "p": p,
                             "gc": 1 if kv.get("LATTYPE", "GD") == "GC" else 0,
                             "n": int(kv.get("N", 0)), "src": f"{t}: " + kv.get("SRC", "")})
            elif kind in ("START", "REF"):
                p = [get_s(kv["T"]), get_s(kv.get("END", "0")), get_s(kv["T"]),
                     float(kv["LAT"]), float(kv["LON"]), float(kv["ALT"]),
                     float(kv["V"]), float(kv["FPA"]), float(kv.get("HDG", 0)), 0.0, 0.0, 0.0]
                sim["start" if kind == "START" else "ref"].append(
                    {"m": cur["n"], "p": p, "gc": 1 if kv.get("LATTYPE", "GD") == "GC" else 0,
                     "body": {"EARTH": 1, "MOON": 2}[kv["BODY"]],
                     "src": kind + ": " + kv.get("SRC", "")})
            elif kind == "BURN":
                sim["burn"].append({"m": cur["n"], "t": get_s(kv["T"]), "dv": float(kv["DV"]),
                                    "dir": (float(kv["P"]), float(kv["R"]), float(kv["N"])),
                                    "body": {"EARTH": 1, "MOON": 2}[kv["BODY"]],
                                    "src": "BURN: " + kv.get("SRC", "")})
            elif kind == "EVENT":
                evs.append({"m": cur["n"], "kind": EVENT_KINDS[kv["KIND"]], "t": get_s(kv["T"]),
                            "src": kv["KIND"] + ": " + kv.get("SRC", "")})
    mis.sort(key=lambda m: m["n"])
    assert [m["n"] for m in mis] == list(range(1, len(mis) + 1)), "scenario ids must be 1..N"
    for m in mis:
        assert sum(1 for x in sim["start"] if x["m"] == m["n"]) <= 1, "one START per scenario"
    return mis, legs, evs, sim


def comment_wrap(txt, lead="C       "):
    """A source string as fixed-form comment lines."""
    out, line = [], lead
    for w in txt.split():
        if len(line) + len(w) + 1 > 72:
            out.append(line.rstrip()); line = lead
        line += w + " "
    out.append(line.rstrip())
    return out


def meeus47():
    """Tables 47.A (D M M' F sigma_l sigma_r) and 47.B (D M M' F sigma_b) from data/meeus47.txt,
    checked against Meeus's example 47.a before use."""
    a, b, cur = [], [], None
    for ln in (D / "meeus47.txt").read_text().splitlines():
        if not ln.strip() or ln.startswith("#"):
            continue
        if ln.strip() in ("A", "B"):
            cur = a if ln.strip() == "A" else b
            continue
        cur.append([int(x) for x in ln.split()])
    assert len(a) == 60 and len(b) == 60
    # Example 47.a: 1992 April 12, 0h TD, JDE 2448724.5.
    t = (2448724.5 - 2451545.0) / 36525.0
    lp = 218.3164477 + 481267.88123421 * t - 0.0015786 * t * t + t ** 3 / 538841 - t ** 4 / 65194000
    dd = 297.8501921 + 445267.1114034 * t - 0.0018819 * t * t + t ** 3 / 545868 - t ** 4 / 113065000
    m = 357.5291092 + 35999.0502909 * t - 0.0001536 * t * t + t ** 3 / 24490000
    mp = 134.9633964 + 477198.8675055 * t + 0.0087414 * t * t + t ** 3 / 69699 - t ** 4 / 14712000
    f = 93.2720950 + 483202.0175233 * t - 0.0036539 * t * t - t ** 3 / 3526000 + t ** 4 / 863310000
    a1, a2, a3 = 119.75 + 131.849 * t, 53.09 + 479264.290 * t, 313.45 + 481266.484 * t
    e = 1 - 0.002516 * t - 0.0000074 * t * t
    r = math.radians
    sl = sr = sb = 0.0
    for d_, m_, mp_, f_, cl, cr in a:
        arg = r(d_ * dd + m_ * m + mp_ * mp + f_ * f)
        k = e ** abs(m_)
        sl += cl * k * math.sin(arg)
        sr += cr * k * math.cos(arg)
    for d_, m_, mp_, f_, cb in b:
        sb += cb * e ** abs(m_) * math.sin(r(d_ * dd + m_ * m + mp_ * mp + f_ * f))
    sl += 3958 * math.sin(r(a1)) + 1962 * math.sin(r(lp - f)) + 318 * math.sin(r(a2))
    sb += (-2235 * math.sin(r(lp)) + 382 * math.sin(r(a3)) + 175 * math.sin(r(a1 - f))
           + 175 * math.sin(r(a1 + f)) + 127 * math.sin(r(lp - mp)) - 115 * math.sin(r(lp + mp)))
    lam = (lp + sl / 1e6) % 360
    beta = sb / 1e6
    dist = 385000.56 + sr / 1000
    assert abs(lam - 133.162655) < 2e-6 and abs(beta + 3.229126) < 2e-6 and abs(dist - 368409.7) < 0.1, \
        (lam, beta, dist)
    return a, b


def fdata(arr, vals, fmt, per=5, chunk=95):
    """Fixed-form DATA statements for arr(1..n), chunk values per statement.

    Each statement stays within 19 continuation lines (the FORTRAN 77 limit) and
    72 columns, so any period compiler would take it."""
    out = []
    for k in range(0, len(vals), chunk):
        part = vals[k:k + chunk]
        lines = [f"      DATA ({arr}(IBD),IBD={k + 1},{k + len(part)}) /"]
        for i in range(0, len(part), per):
            txt = ",".join(fmt % v for v in part[i:i + per])
            last = i + per >= len(part)
            lines.append("     1 " + txt + ("/" if last else ","))
        for ln in lines:
            assert len(ln) <= 72, ln
        out += lines
    return "\n".join(out) + "\n"


def dfmt(nd):
    """Double precision constant with nd decimals, D exponent."""
    return lambda v: ("%." + str(nd) + "f") % v + "D0"


class F:
    def __init__(self, f): self.f = f
    def __mod__(self, v): return self.f(v)


def main():
    nav = nav_stars()
    stars, navmag = catalog_stars(nav)
    coast = coastlines()
    crat = craters()

    # nav stars first, then background stars; polylines flattened with a start index
    sx = [v[0] for v in nav] + [s[0][0] for s in stars]
    sy = [v[1] for v in nav] + [s[0][1] for s in stars]
    sz = [v[2] for v in nav] + [s[0][2] for s in stars]
    sm = navmag + [s[1] for s in stars]
    clon, clat, cstart = [], [], []
    for ln in coast:
        cstart.append(len(clon) + 1)
        for lo, la in ln:
            clon.append(lo)
            clat.append(la)
    cstart.append(len(clon) + 1)

    mar = maria()
    mis, legs, evs, sim = scenarios()
    m47a, m47b = meeus47()
    nst, nbn, nrf = (max(1, len(sim[k])) for k in ("start", "burn", "ref"))
    ns, npt, nln, ncr = len(sx), len(clon), len(coast), len(crat)
    inc = ["C     Generated by tools/gen_data.py from data/. Do not edit.",
           "C     Table sizes shared by the kernel (src/*.f) and its BLOCK DATA.",
           "      INTEGER NSTAR, NNAV, NCPT, NCST, NCRAT, NMARE",
           "C     RESTOMOD BEGIN: parenthesised PARAMETER list is FORTRAN 77",
           "C     (1978); FORTRAN V wrote PARAMETER I = 2 (UP-4046 sec. 10.4.1)",
           f"      PARAMETER (NSTAR={ns}, NNAV=37, NCPT={npt}, NCST={nln})",
           f"      PARAMETER (NCRAT={ncr}, NMARE={len(mar)})",
           "C     RESTOMOD END",
           "C     Scenarios (data/scenarios): scenarios, trajectory legs of",
           "C     NLGP parameters, events; leg types and event kinds.",
           "      INTEGER NSN, NLEG, NEVT, NLGP",
           "      INTEGER KCIRC, KCONIC, KLUNAR",
           "      INTEGER " + ", ".join(EVENT_PARAMS.values()),
           "C     RESTOMOD BEGIN: parenthesised PARAMETER list is FORTRAN 77",
           f"      PARAMETER (NSN={len(mis)}, NLEG={len(legs)}, NEVT={len(evs)}, NLGP={NLGP})",
           "C     Simulation cards (START, BURN, REF): array sizes, at least 1.",
           "      INTEGER NSTRT, NBURN, NREF",
           f"      PARAMETER (NSTRT={nst}, NBURN={nbn}, NREF={nrf})",
           "      PARAMETER (" + ", ".join(f"K{k}={v}" for k, v in
                                        (("CIRC", 1), ("CONIC", 2), ("LUNAR", 3))) + ")",
           "      PARAMETER (" + ", ".join(f"{EVENT_PARAMS[k]}={v}" for k, v in
                                        list(EVENT_KINDS.items())[:4]) + ")",
           "      PARAMETER (" + ", ".join(f"{EVENT_PARAMS[k]}={v}" for k, v in
                                        list(EVENT_KINDS.items())[4:]) + ")",
           "C     RESTOMOD END"]
    for ln in inc:
        assert len(ln) <= 72, ln
    (R / "src" / "viewdims.inc").write_text("\n".join(inc) + "\n")

    b = ["C     Generated by tools/gen_data.py from data/. Do not edit.",
         "C",
         "C     /CSTAR/  star unit vectors, J2000 equatorial, and visual magnitude.",
         "C              1..37 are the AGC nav stars (Comanche055, precessed to J2000).",
         "C     /CCOST/  Natural Earth 1:110m coastlines, geodetic lon/lat (deg).",
         "C              Polyline K runs KCST(K) .. KCST(K+1)-1.",
         "C     /CCRAT/  IAU gazetteer craters: selenographic lat, east lon (deg),",
         "C              diameter (km), largest first.",
         "C     RESTOMOD BEGIN: implied-DO DATA not found in FORTRAN V docs;",
         "C     the 1108 loader skips unreferenced BLOCK DATA (docs/univac-1108.md);",
         "C     coastlines (Natural Earth, 2009) and craters (IAU, 1970 on).",
         "      BLOCK DATA VIEWBD",
         "      INCLUDE 'viewdims.inc'",
         "      DOUBLE PRECISION STX(NSTAR), STY(NSTAR), STZ(NSTAR), STM(NSTAR)",
         "      DOUBLE PRECISION CLON(NCPT), CLAT(NCPT)",
         "      INTEGER KCST(NCST+1)",
         "      DOUBLE PRECISION CRLAT(NCRAT), CRLON(NCRAT), CRDIA(NCRAT)",
         "      INTEGER NAVCH(370), BODCH(15), SITECH(22)",
         "      DOUBLE PRECISION MRLAT(NMARE), MRLON(NMARE), MRDIA(NMARE)",
         "      INTEGER MRCH(24*NMARE)",
         "      INTEGER IBD",
         "      COMMON /CSTAR/ STX, STY, STZ, STM",
         "      COMMON /CCOST/ CLON, CLAT, KCST",
         "      COMMON /CCRAT/ CRLAT, CRLON, CRDIA",
         "C     /CNAME/  label text as character codes (ASCII), 10 per nav star",
         "C              and 5 each for SUN, EARTH, MOON, zero padded.",
         "      COMMON /CNAME/ NAVCH, BODCH, SITECH",
         "C     /CMARE/  maria, lacus, sinus, oceanus: centre lat, east lon (deg),",
         "C              diameter (km) and names (24 codes each, zero padded).",
         "      COMMON /CMARE/ MRLAT, MRLON, MRDIA, MRCH",
         "C     /CSCEN/  scenarios (run decks).  Scenario M: epoch SNJD0 (JD of",
         "C              range zero),",
         "C              landing site SNSLA lat, SNSLO east lon, SNSAZ descent",
         "C              azimuth (deg).",
         "C              Leg K of scenario LGSN(K), type LGTYP, whole revolutions",
         "C              LGN (LUNAR), latitude geocentric if LGGC = 1, and LGP:",
         "C              1 FROM, 2 TO, 3 T (g.e.t. s), 4 LAT, 5 LON (deg),",
         "C              6 ALT (n mi), 7 V (ft/s), 8 FPA, 9 HDG (deg),",
         "C              10 TB (s), 11 LATB, 12 LONB (deg).",
         "C              Event J of scenario EVSN(J), kind EVKND, g.e.t. EVT (s).",
         "      DOUBLE PRECISION SNJD0(NSN), SNSLA(NSN), SNSLO(NSN)",
         "      DOUBLE PRECISION SNSAZ(NSN)",
         "      DOUBLE PRECISION LGP(NLGP,NLEG), EVT(NEVT)",
         "      INTEGER LGSN(NLEG), LGTYP(NLEG), LGN(NLEG), LGGC(NLEG)",
         "      INTEGER EVSN(NEVT), EVKND(NEVT)",
         "      COMMON /CSCEN/ SNJD0, SNSLA, SNSLO, SNSAZ, LGP, EVT",
         "      COMMON /CSCENI/ LGSN, LGTYP, LGN, LGGC, EVSN, EVKND",
         "C     /CSIM/   simulation cards.  START of scenario STSN (one at most),",
         "C              REF rows: state STP / RFP as LGP (2 = END for START),",
         "C              body STBOD / RFBOD (1 Earth, 2 Moon), geocentric",
         "C              latitude if STGC / RFGC = 1.  BURN: mid-burn g.e.t.",
         "C              BNT (s), BNDV (ft/s), direction BNP, BNR, BNN in the",
         "C              BNBOD body's frame (along the velocity, radial in the",
         "C              orbit plane, orbit normal).  NSTART, NBN, NRF: used.",
         "      DOUBLE PRECISION STP(NLGP,NSTRT), RFP(NLGP,NREF)",
         "      DOUBLE PRECISION BNT(NBURN), BNDV(NBURN), BNP(NBURN)",
         "      DOUBLE PRECISION BNR(NBURN), BNN(NBURN)",
         "      INTEGER STSN(NSTRT), STBOD(NSTRT), STGC(NSTRT), NSTART",
         "      INTEGER RFSN(NREF), RFBOD(NREF), RFGC(NREF), NRF",
         "      INTEGER BNSN(NBURN), BNBOD(NBURN), NBN",
         "      COMMON /CSIM/ STP, RFP, BNT, BNDV, BNP, BNR, BNN",
         "C     /CMEEUS/ Meeus ch. 47 lunar terms, flattened: MMA(6*(K-1)+1..6)",
         "C              = D M M' F sigma_l sigma_r of table 47.A row K,",
         "C              MMB(5*(K-1)+1..5) = D M M' F sigma_b of table 47.B.",
         "      INTEGER MMA(360), MMB(300)",
         "      COMMON /CMEEUS/ MMA, MMB",
         "      COMMON /CSIMI/ STSN, STBOD, STGC, NSTART, RFSN, RFBOD, RFGC,",
         "     &               NRF, BNSN, BNBOD, NBN"]
    body = "\n".join(b) + "\n"
    f7, f2, f3, f1 = F(dfmt(7)), F(dfmt(2)), F(dfmt(3)), F(dfmt(1))
    body += fdata("STX", sx, f7) + fdata("STY", sy, f7) + fdata("STZ", sz, f7)
    body += fdata("STM", sm, f2, 8)
    body += fdata("CLON", clon, f3, 5) + fdata("CLAT", clat, f3, 5)
    body += fdata("KCST", cstart, "%d", 10)
    body += fdata("CRLAT", [c[0] for c in crat], f3, 5)
    body += fdata("CRLON", [c[1] for c in crat], f3, 5)
    body += fdata("CRDIA", [c[2] for c in crat], f1, 6)
    navch = []
    for nm in NAV_NAMES:
        assert len(nm) <= 10
        navch += [ord(ch) for ch in nm] + [0] * (10 - len(nm))
    bodch = []
    for nm in ("SUN", "EARTH", "MOON"):
        bodch += [ord(ch) for ch in nm] + [0] * (5 - len(nm))
    body += fdata("NAVCH", navch, "%d", 10) + fdata("BODCH", bodch, "%d", 10)
    body += fdata("SITECH", [ord(ch) for ch in "APOLLO 11 LANDING SITE"], "%d", 10)
    mrch = []
    for m in mar:
        nm = m[3][:24]
        mrch += [ord(ch) for ch in nm] + [0] * (24 - len(nm))
    body += fdata("MRLAT", [m[0] for m in mar], f3, 5)
    body += fdata("MRLON", [m[1] for m in mar], f3, 5)
    body += fdata("MRDIA", [m[2] for m in mar], f1, 6)
    body += fdata("MRCH", mrch, "%d", 10)
    # Scenarios, with each card's source as comments.
    for m in mis:
        body += "\n".join([f"C     SCENARIO {m['n']} {m['name']}"] +
                          sum((comment_wrap(x) for x in m["src"]), [])) + "\n"
    body += fdata("SNJD0", [m["jd"] for m in mis], F(dfmt(6)), 3)
    body += fdata("SNSLA", [m["site"][0] for m in mis], F(dfmt(5)), 3)
    body += fdata("SNSLO", [m["site"][1] for m in mis], F(dfmt(5)), 3)
    body += fdata("SNSAZ", [m["site"][2] for m in mis], F(dfmt(3)), 3)
    for k, lg in enumerate(legs):
        body += "\n".join([f"C     LEG {k + 1}"] + comment_wrap(lg["src"])) + "\n"
        body += "\n".join(f"      DATA LGP({i + 1},{k + 1}) / {v:.3f}D0 /"
                          for i, v in enumerate(lg["p"])) + "\n"
    body += fdata("LGSN", [lg["m"] for lg in legs], "%d", 10)
    body += fdata("LGTYP", [lg["type"] for lg in legs], "%d", 10)
    body += fdata("LGN", [lg["n"] for lg in legs], "%d", 10)
    body += fdata("LGGC", [lg["gc"] for lg in legs], "%d", 10)
    for j, ev in enumerate(evs):
        body += "\n".join([f"C     EVENT {j + 1}"] + comment_wrap(ev["src"])) + "\n"
    body += fdata("EVT", [ev["t"] for ev in evs], F(dfmt(1)), 4)
    body += fdata("EVSN", [ev["m"] for ev in evs], "%d", 10)
    body += fdata("EVKND", [ev["kind"] for ev in evs], "%d", 10)
    # Simulation cards.  Empty tables get one zero entry and a count of 0.
    for key, pa, sn, bod, gc in (("start", "STP", "STSN", "STBOD", "STGC"),
                                 ("ref", "RFP", "RFSN", "RFBOD", "RFGC")):
        rows = sim[key] or [{"m": 0, "p": [0.0] * NLGP, "gc": 0, "body": 0, "src": ""}]
        for k, r in enumerate(rows):
            if r["src"]:
                body += "\n".join([f"C     {key.upper()} {k + 1}"] + comment_wrap(r["src"])) + "\n"
            body += "\n".join(f"      DATA {pa}({i + 1},{k + 1}) / {v:.3f}D0 /"
                              for i, v in enumerate(r["p"])) + "\n"
        body += fdata(sn, [r["m"] for r in rows], "%d", 10)
        body += fdata(bod, [r["body"] for r in rows], "%d", 10)
        body += fdata(gc, [r["gc"] for r in rows], "%d", 10)
    bn = sim["burn"] or [{"m": 0, "t": 0.0, "dv": 0.0, "dir": (0.0, 0.0, 0.0), "body": 0, "src": ""}]
    for k, b_ in enumerate(bn):
        if b_["src"]:
            body += "\n".join([f"C     BURN {k + 1}"] + comment_wrap(b_["src"])) + "\n"
    body += fdata("BNT", [b_["t"] for b_ in bn], F(dfmt(2)), 4)
    body += fdata("BNDV", [b_["dv"] for b_ in bn], F(dfmt(1)), 4)
    body += fdata("BNP", [b_["dir"][0] for b_ in bn], F(dfmt(3)), 4)
    body += fdata("BNR", [b_["dir"][1] for b_ in bn], F(dfmt(3)), 4)
    body += fdata("BNN", [b_["dir"][2] for b_ in bn], F(dfmt(3)), 4)
    body += fdata("BNSN", [b_["m"] for b_ in bn], "%d", 10)
    body += fdata("BNBOD", [b_["body"] for b_ in bn], "%d", 10)
    body += fdata("MMA", [v for r_ in m47a for v in r_], "%d", 6)
    body += fdata("MMB", [v for r_ in m47b for v in r_], "%d", 5)
    body += f"      DATA NSTART, NRF, NBN / {len(sim['start'])}, {len(sim['ref'])}, {len(sim['burn'])} /\n"
    body += "      END\nC     RESTOMOD END\n"
    (R / "src" / "viewdata.f").write_text(body)

    # Names for labels: crater names only for the larger primary craters.
    # NAV_MAG: magnitude of the 354th brightest non-named star (37 named + 354 = 391), the limit for the approximated 391-star navigation
    # catalog (TN D-6853 p.12); the page draws only stars at or brighter than this in its NAV catalog.
    nav_mag = round(sorted(s[1] for s in stars)[391 - 37 - 1], 2)
    names = {"NAV": NAV_NAMES, "NAV_MAG": nav_mag,
             "CRATER": [c[3] if (c[4] == "AA" and c[2] >= 20) else "" for c in crat]}
    (R / "build").mkdir(exist_ok=True)
    (R / "build" / "names.js").write_text("const VIEW_NAMES = " + json.dumps(names) + ";\n")
    print(f"stars {len(sx)} (nav 37), coast {len(coast)} lines / {len(clon)} pts, "
          f"craters {len(crat)}, scenarios {len(mis)} ({len(legs)} legs, {len(evs)} events, "
          f"{len(sim['start'])} start, {len(sim['burn'])} burns, {len(sim['ref'])} reference rows)")
    for i in (4, 12, 29):
        x, y, z = nav[i]
        print(f"  check {NAV_NAMES[i]}: RA {math.degrees(math.atan2(y, x)) % 360:.2f} "
              f"Dec {math.degrees(math.asin(z)):.2f}  mag {navmag[i]}")


if __name__ == "__main__":
    main()
