#!/usr/bin/env python3
"""Generate src/viewdata.f (BLOCK DATA), src/viewdims.inc and build/names.js from data/.

Inputs (all in data/):
  Comanche055_STAR_TABLES.agc   the 37 Apollo nav stars as AGC unit vectors (1969.5 epoch)
  stars.6.json                  d3-celestial star catalog (J2000 RA/Dec, V mag)
  ne_110m_coastline.geojson     Natural Earth 1:110m coastlines
  MOON_nomenclature_center_pts.dbf   IAU lunar gazetteer (crater centres and diameters)

Everything is written in the J2000 equatorial frame. AGC star vectors are precessed
from 1969.5 to J2000 so they share a frame with the catalog.
"""
import json, math, pathlib, re, struct

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

    ns, npt, nln, ncr = len(sx), len(clon), len(coast), len(crat)
    inc = ["C     Generated by tools/gen_data.py from data/. Do not edit.",
           "C     Table sizes shared by the kernel (view.f) and its BLOCK DATA.",
           "      INTEGER NSTAR, NNAV, NCPT, NCST, NCRAT",
           "C     RESTOMOD BEGIN: parenthesised PARAMETER list is FORTRAN 77",
           "C     (1978); FORTRAN V wrote PARAMETER I = 2 (UP-4046 sec. 10.4.1)",
           f"      PARAMETER (NSTAR={ns}, NNAV=37, NCPT={npt}, NCST={nln})",
           f"      PARAMETER (NCRAT={ncr})",
           "C     RESTOMOD END"]
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
         "      INTEGER IBD",
         "      COMMON /CSTAR/ STX, STY, STZ, STM",
         "      COMMON /CCOST/ CLON, CLAT, KCST",
         "      COMMON /CCRAT/ CRLAT, CRLON, CRDIA"]
    body = "\n".join(b) + "\n"
    f7, f2, f3, f1 = F(dfmt(7)), F(dfmt(2)), F(dfmt(3)), F(dfmt(1))
    body += fdata("STX", sx, f7) + fdata("STY", sy, f7) + fdata("STZ", sz, f7)
    body += fdata("STM", sm, f2, 8)
    body += fdata("CLON", clon, f3, 5) + fdata("CLAT", clat, f3, 5)
    body += fdata("KCST", cstart, "%d", 10)
    body += fdata("CRLAT", [c[0] for c in crat], f3, 5)
    body += fdata("CRLON", [c[1] for c in crat], f3, 5)
    body += fdata("CRDIA", [c[2] for c in crat], f1, 6)
    body += "      END\nC     RESTOMOD END\n"
    (R / "src" / "viewdata.f").write_text(body)

    # Names for labels: crater names only for the larger primary craters.
    names = {"NAV": NAV_NAMES,
             "CRATER": [c[3] if (c[4] == "AA" and c[2] >= 20) else "" for c in crat]}
    (R / "build").mkdir(exist_ok=True)
    (R / "build" / "names.js").write_text("const VIEW_NAMES = " + json.dumps(names) + ";\n")
    print(f"stars {len(sx)} (nav 37), coast {len(coast)} lines / {len(clon)} pts, "
          f"craters {len(crat)}")
    for i in (4, 12, 29):
        x, y, z = nav[i]
        print(f"  check {NAV_NAMES[i]}: RA {math.degrees(math.atan2(y, x)) % 360:.2f} "
              f"Dec {math.degrees(math.asin(z)):.2f}  mag {navmag[i]}")


if __name__ == "__main__":
    main()
