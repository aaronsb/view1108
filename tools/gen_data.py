#!/usr/bin/env python3
"""Generate src/viewdata.f (BLOCK DATA, the static catalogs), src/viewdims.inc and build/names.js
from data/, and check the run decks (data/missions) the kernel's card reader (src/vdeck.f) loads.

Inputs (all in data/):
  Comanche055_STAR_TABLES.agc   the 37 Apollo nav stars as AGC unit vectors (1969.5 epoch)
  stars.6.json                  d3-celestial star catalog (J2000 RA/Dec, V mag)
  ne_110m_coastline.geojson     Natural Earth 1:110m coastlines
  MOON_nomenclature_center_pts.dbf   IAU lunar gazetteer (crater centres and diameters)
  missions/<id>/mission.scn     a mission's identity: name, epoch (range zero), landing site, pad
  missions/<id>/*.scn           its scenarios (run decks): trajectory legs, events, timeline
  meeus47.txt                   Meeus ch. 47 lunar periodic terms (tables 47.A and 47.B)
  missions/<id>/*.scn           also each scenario's situations (SITUATION, RECIPE, VIEWS, HDRREF
                                cards) -> build/scenes.json, and with its SPAN cards ->
                                build/names.js (SITUATIONS, SCENARIOS)
  reels/<id>/run.scn            playlist reels (REEL and SHOT cards) -> build/names.js (REELS)

Also the card reader's vocabulary (its card kinds, keys and code words, from the tables below)
-> src/vdvoc.f and src/vdvoc.inc, and the decks in load order -> build/decks.txt (for the native
driver and the gates; the page's copies are the reel packages, tools/pack.py).

Everything is written in the J2000 equatorial frame. AGC star vectors are precessed
from 1969.5 to J2000 so they share a frame with the catalog.
"""
import decimal, json, math, pathlib, re, shlex, struct

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
LEG_TYPES = {"CIRC": 1, "CONIC": 2, "LUNAR": 3, "LCONIC": 4, "TABLE": 5}
LEG_VEH = {"CSM": 1, "LM": 2, "SIVB": 3}   # 3: as the burn cue's BURN_VEH below
LATTYPES = {"GD": 0, "GC": 1}              # latitude geodetic (default) or geocentric
ROW_VELS = {"SF": 0, "EF": 1}              # a ROW's velocity space-fixed (default) or Earth-fixed
EVENT_KINDS = {"TDATT": 1, "SEP": 2, "APPR": 3, "DOCK": 4, "UNDOCK": 5, "TOUCH": 6, "EI": 7,
               "PTC": 8, "TLI": 9, "LOI1": 10, "LOI2": 11, "PHOTO": 12, "TEI": 13,
               "LMSEP": 14, "PDI": 15, "LIFT": 16, "TPF": 17, "LMDOK": 18, "JETT": 19,
               "CMSEP": 20, "EJECT": 21, "SLING": 22}
EVENT_PARAMS = {"TDATT": "KETDA", "SEP": "KESEP", "APPR": "KEAPR", "DOCK": "KEDOK",
                "UNDOCK": "KEUND", "TOUCH": "KETD", "EI": "KEEI", "PTC": "KEPTC",
                "TLI": "KETLI", "LOI1": "KELOI1", "LOI2": "KELOI2", "PHOTO": "KEPHO",
                "TEI": "KETEI", "LMSEP": "KELMS", "PDI": "KEPDI", "LIFT": "KELFT",
                "TPF": "KETPF", "LMDOK": "KELDK", "JETT": "KEJET",
                "CMSEP": "KECMS", "EJECT": "KEEJC", "SLING": "KESLG"}
# Timeline card kinds (TIMELINE KIND=): a small enum shared with the kernel (/CTLN/) and the
# page (build/names.js); see CLAUDE.md, "Scenario timeline".
TL_KINDS = {"LAUNCH": 1, "BURN": 2, "STAGING": 3, "ORBIT": 4, "SEP": 5, "SURFACE": 6, "TV": 7,
            "CREW": 8, "PHOTO": 9, "ENTRY": 10, "MARK": 11}
NLGP = 17   # leg parameters, see scenarios()
# The burn cue (src/lburn.f; ours, a modern addition): the main-engine firings, from each
# scenario's BURNCUE cards, each naming the two TIMELINE rows of its scenario that open and close
# it and whose engine it is.  Vehicles: 1 CSM, 2 LM, 3 S-IVB.  Engines: 1 SPS, 2 DPS (descent),
# 3 APS (ascent), 4 the S-IVB's J-2.
BURN_VEH = {"CSM": 1, "LM": 2, "S-IVB": 3}
BURN_ENG = {"SPS": 1, "DPS": 2, "APS": 3, "J-2": 4}


def burn_cues(sim):
    """Check the BURNCUE cards against the TIMELINE rows of sim: each names an ignition row of
    its scenario and a cutoff row after it (a name that occurs more than once: the first
    ignition and the first cutoff after it).  Returns the number of cues."""
    for c in sim["cue"]:
        m, ign, cut = c["m"], c["ign"], c["cut"]
        rows = sorted((r for r in sim["tl"] if r["m"] == m), key=lambda r: r["t"])
        t1 = [r for r in rows if r["name"] == ign]
        assert t1, f"burn cue: scenario {m} has no TIMELINE row {ign!r}"
        assert any(r["name"] == cut and r["t"] > t1[0]["t"] for r in rows), \
            f"burn cue: scenario {m} has no TIMELINE row {cut!r} after {ign!r}"
    return len(sim["cue"])
# Keys each card type reads.  Other keys are ignored with a warning, so cards can grow
# (a BURN's TRIGGER= and TARGET= are planned, docs/simulation.md) without breaking old decks.
CARD_KEYS = {
    "MISSION": {"NAME", "SRC"},
    "SCENARIO": {"ID", "NAME", "SRC"},
    "EPOCH": {"JD", "SRC"},
    "SITE": {"NAME", "LAT", "LON", "AZ", "SRC"},
    "PAD": {"NAME", "LAT", "LON", "LATTYPE", "SRC"},
    "LEG": {"TYPE", "FROM", "TO", "T", "LATTYPE", "LAT", "LON", "ALT", "V", "FPA", "HDG",
            "TB", "LATB", "LONB", "N", "VEH", "DV", "P", "R", "ALTB", "SRC"},
    "ROW": {"T", "LAT", "LON", "ALT", "V", "FPA", "HDG", "VEL", "SRC"},
    "EVENT": {"KIND", "T", "SRC"},
    "TIMELINE": {"T", "KIND", "NAME", "SRC"},
    "START": {"T", "END", "BODY", "LATTYPE", "LAT", "LON", "ALT", "V", "FPA", "HDG", "SRC"},
    "REF": {"T", "BODY", "LATTYPE", "LAT", "LON", "ALT", "V", "FPA", "HDG", "SRC"},
    "BURN": {"T", "DV", "BODY", "P", "R", "N", "SRC"},
    "BURNCUE": {"IGN", "CUT", "VEH", "ENG", "SRC"},
    "SITUATION": {"ID", "NAME", "TITLE", "CAPTION", "GET", "FOV", "LOOK", "WINDOW", "LAYERS",
                  "POSE", "DRAW", "SRC"},
    "RECIPE": {"NAME", "BODY", "MODE", "AZ", "ELEV", "TURN", "OFFLEG", "OFFELEV", "ATT", "AT",
               "FIX", "DRIFT", "ELOFF", "VEH", "ALT", "DIST", "SRC"},
    "VIEWS": {"VIEW", "TARGET", "OFFTARGET", "RIDES", "CM", "LM", "FIXED", "XSTART", "SRC"},
    "HDRREF": {"OBJ", "OFFSET", "RADIUS", "SRC"},
    "SPAN": {"TRACK", "SIT", "UNTIL", "FROM", "LEN", "VIEW", "TARGET", "FOV", "NAME", "BUTTON",
             "CAPTION", "SRC"},
    "REEL": {"ID", "TITLE", "KIND", "ALIAS", "NEXT", "FADE", "FILM", "TAG", "SRC"},
    "SHOT": {"SIT", "NAME", "DUR", "GET", "RATE", "TO", "AT", "TTE", "LIMB", "FOV", "YAW", "PITCH",
             "ROLL", "VIEW", "TARGET", "LABELS", "FRAME", "CAPTION", "SRC"},
    # A tape (#26 slice 6): its header card, then rows of seven numbers with no card word (the
    # kernel's reader takes them; tools/vtape.f writes them).  No deck this script reads has one.
    "TAPE": {"SCN", "CHAN", "SRC"},
}


# A card's number and g.e.t., the grammar the kernel's card reader takes (src/vdeck.f DKNMS,
# DKGTS): one sign, digits with one point at most, an E exponent of three digits at most; h:mm or
# h:mm:ss.s with one leading - at most.  17 significant digits at most and a power of ten from
# 10**-44 to 10**22: the reader reads 15 digits within 10**22 with one exact scale, and the rest
# (DKDD) in two doubles, rounded once; both give the decimal correctly rounded.  A g.e.t.
# h:mm:ss.s holds 15 digits.  ASCII digits only.
NUM_RE = re.compile(r"([+-]?)(\d+\.?\d*|\.\d+)(?:[eE]([+-]?\d{1,3}))?", re.ASCII)
GET_RE = re.compile(r"(-?)(\d+):(\d+)(?::(\d+\.?\d*|\.\d+))?", re.ASCII)


def exact_digits(mant, scale, where):
    """Check a number the reader takes: its mantissa's significant digits (17 at most) and its
    power of ten (10**-44 to 10**22 unless it is zero)."""
    digits = mant.replace(".", "").lstrip("0")
    assert len(digits) <= 17, f"{where}: more than 17 significant digits"
    assert not digits or -44 <= scale <= 22, f"{where}: exponent out of range"


def card_num(tok):
    """A card's decimal number (or a default, such as 0) as a float, refused unless the card
    reader's grammar takes it (NUM_RE, exact_digits)."""
    tok = str(tok)
    m = NUM_RE.fullmatch(tok)
    assert m, f"{tok!r}: not a number (one sign, digits, one point, an E exponent)"
    frac = len(m.group(2).split(".")[1]) if "." in m.group(2) else 0
    exact_digits(m.group(2), int(m.group(3) or 0) - frac, tok)
    return float(tok)


def get_s(v):
    """g.e.t. h:mm:ss.s, h:mm (or plain seconds) to seconds; a leading - counts down to range zero.
    The seconds are the card's digits with h and mm folded in (h*3600 + mm*60 + ss, in decimal
    arithmetic), correctly rounded to a double, as the kernel's reader makes them, so Python
    orders times as the kernel does."""
    if ":" not in v:
        return card_num(v)
    g = GET_RE.fullmatch(v)
    assert g, f"{v!r}: not a g.e.t. (h:mm or h:mm:ss.s, one leading - at most)"
    neg = g.group(1) == "-"
    for f in g.group(2, 3, 4):
        exact_digits(f or "", 0, v)
    ss = g.group(4) or "0"
    frac = len(ss.split(".")[1]) if "." in ss else 0
    total = (int(g.group(2)) * 3600 + int(g.group(3)) * 60) * 10 ** frac + int(ss.replace(".", "") or 0)
    assert frac <= 15 and total < 10 ** 15, f"{v!r}: more digits than the reader holds exactly"
    d = decimal.Decimal(int(g.group(2)) * 3600 + int(g.group(3)) * 60) + decimal.Decimal(ss)
    return -float(d) if neg else float(d)


def table_legs(name, tab):
    """A LEG TYPE=TABLE and its ROW cards as one leg per pair of rows in g.e.t. order (type
    TABLE, the kernel's KTABL): LGP 3-9 the first row's T LAT LON ALT V FPA HDG, 10-12 the second's
    T LAT LON, 13-15 its V FPA HDG, 17 its ALT; LGN bit 1 (value 1) the first row's velocity
    Earth-fixed (VEL=EF), bit 2 (value 2) the second's; FROM and TO the two rows' times."""
    rows = tab["rows"]
    assert len(rows) >= 2, f"{name}: a TABLE leg needs two ROW cards or more"
    assert all(a["t"] < b["t"] for a, b in zip(rows, rows[1:])), f"{name}: TABLE rows out of order"
    out = []
    for a, b in zip(rows, rows[1:]):
        fa, fb = a["f"], b["f"]
        p = [a["t"], b["t"], a["t"], *fa, b["t"], fb[0], fb[1], fb[3], fb[4], fb[5], 0.0, fb[2]]
        assert len(p) == NLGP
        out.append({"m": tab["m"], "type": LEG_TYPES["TABLE"], "p": p, "gc": tab["gc"],
                    "veh": tab["veh"], "n": a["ef"] + 2 * b["ef"],
                    "src": f"TABLE: {tab['src']} Rows: {a['src']}; {b['src']}"})
    return out


# The mission's cards: data/missions/<id>/mission.scn holds these and nothing else.
MISSION_CARDS = {"MISSION", "EPOCH", "SITE", "PAD"}


def cards(path):
    """One deck's cards as (kind, keys), comment and blank lines skipped, ending with ("*END", {}).
    Unknown cards and keys are dropped with a warning.  Tokens as the card reader splits them
    (src/vdeck.f DKTOK): blanks outside double or single quotes, no escapes; 1024 codes a card."""
    name = path.relative_to(D)
    for ln in path.read_text().splitlines():
        if not ln.strip() or ln.startswith("*"):
            continue
        assert len(ln.encode()) <= 1024, f"{name}: a card longer than 1024 codes"
        lex = shlex.shlex(ln, posix=True)
        lex.whitespace_split, lex.escape, lex.commenters = True, "", ""
        tok = list(lex)
        assert all("=" in t for t in tok[1:]), f"{name}: {tok[0]} card: a word without ="
        kind, kv = tok[0], dict(t.split("=", 1) for t in tok[1:])
        if kind not in CARD_KEYS:
            print(f"warning: {name}: unknown card {kind}, ignored")
            continue
        for k in sorted(set(kv) - CARD_KEYS[kind]):
            print(f"warning: {name}: {kind} card: unknown key {k}, ignored")
        yield kind, kv
    yield "*END", {}


def mission(path):
    """A mission card deck (data/missions/<id>/mission.scn): name, epoch (JD of range zero),
    landing site, launch pad, and each card's source, shared by the mission's scenarios."""
    m = {"name": None, "jd": None, "site": (0.0, 0.0, 0.0), "sitename": "",
         "pad": ("", 0.0, 0.0, 0), "src": []}
    where = path.relative_to(D)
    for kind, kv in cards(path):
        if kind == "*END":
            break
        assert kind in MISSION_CARDS, f"{where}: {kind} card belongs in a scenario"
        assert (kind == "MISSION") == (m["name"] is None), f"{where}: one MISSION card, first"
        for k in ("NAME",) if kind in ("SITE", "PAD") and "NAME" in kv else ():
            assert all(32 <= ord(c) <= 126 for c in kv[k]), f"{where}: {kind} NAME: plain ASCII"
        if kind == "MISSION":
            m["name"] = kv["NAME"]
        elif kind == "EPOCH":
            m["jd"] = card_num(kv["JD"]); m["src"].append("EPOCH: " + kv.get("SRC", ""))
        elif kind == "SITE":
            m["site"] = (card_num(kv["LAT"]), card_num(kv["LON"]), card_num(kv["AZ"]))
            m["sitename"] = kv.get("NAME", "")
            m["src"].append("SITE: " + kv.get("SRC", ""))
        elif kind == "PAD":
            assert len(kv["NAME"]) <= 7, "PAD NAME: at most 7 characters"
            m["pad"] = (kv["NAME"], card_num(kv["LAT"]), card_num(kv["LON"]),
                        LATTYPES[kv.get("LATTYPE", "GD")])
            m["src"].append("PAD: " + kv.get("SRC", ""))
    assert m["name"] and m["jd"] is not None, f"{path.relative_to(D)}: needs MISSION and EPOCH"
    return m


def scenarios():
    """Parse data/missions/*/: each mission's mission.scn and its scenario .scn files, missions
    and files in name order.  Returns scenarios (dicts with id, mission, name, jd, site, pad,
    sources; the mission's cards are copied into each of its scenarios), legs and events, each
    carrying its scenario id and source string."""
    mis, legs, evs, sim = [], [], [], {"start": [], "burn": [], "ref": [], "tl": [], "cue": [],
                                       "sit": [], "span": []}
    for mdir in sorted(p for p in (D / "missions").iterdir() if p.is_dir()):
        mpath = mdir / "mission.scn"
        assert mpath.is_file(), f"{mdir.relative_to(D)}: no mission.scn (the mission's cards)"
        ms = mission(mpath)
        nmis = len(mis)
        for path in sorted(p for p in mdir.glob("*.scn") if p.name != "mission.scn"):
            name = path.relative_to(D)
            cur, tab = None, None
            for kind, kv in cards(path):
                if tab is not None and kind != "ROW":
                    legs += table_legs(name, tab)
                    tab = None
                if kind == "*END":
                    break
                assert kind not in MISSION_CARDS, f"{name}: {kind} card belongs in mission.scn"
                if kind == "SCENARIO":
                    cur = {"n": int(kv["ID"]), "mission": mdir.name, "mname": ms["name"],
                           "name": ms["name"] + " " + kv["NAME"], "jd": ms["jd"],
                           "site": ms["site"], "sitename": ms["sitename"], "pad": ms["pad"],
                           "src": list(ms["src"])}
                    mis.append(cur)
                else:
                    assert cur is not None, f"{name}: {kind} card before the SCENARIO card"
                    tab = scenario_card(name, kind, kv, cur, tab, legs, evs, sim)
        assert len(mis) > nmis, f"{mdir.relative_to(D)}: no scenario (a .scn with a SCENARIO card)"
    mis.sort(key=lambda m: m["n"])
    assert [m["n"] for m in mis] == list(range(1, len(mis) + 1)), "scenario ids must be 1..N"
    for m in mis:
        assert sum(1 for x in sim["start"] if x["m"] == m["n"]) <= 1, "one START per scenario"
    return mis, legs, evs, sim


def scenario_card(name, kind, kv, cur, tab, legs, evs, sim):
    """One card of scenario cur into legs, evs and sim.  Returns the open LEG TYPE=TABLE (its
    ROW cards follow it), or None."""
    if kind == "ROW":
        assert tab is not None, f"{name}: ROW card outside a LEG TYPE=TABLE"
        assert kv.get("VEL", "SF") in ROW_VELS, f"{name}: ROW VEL= SF or EF"
        tab["rows"].append({"t": get_s(kv["T"]),
                            "f": [card_num(kv[k]) for k in ("LAT", "LON", "ALT", "V", "FPA", "HDG")],
                            "ef": ROW_VELS[kv.get("VEL", "SF")],
                            "src": kv.get("SRC", "")})
    elif kind == "LEG" and kv["TYPE"] == "TABLE":
        return {"m": cur["n"], "gc": LATTYPES[kv.get("LATTYPE", "GD")],
                "veh": LEG_VEH[kv.get("VEH", "CSM")], "src": kv.get("SRC", ""), "rows": []}
    elif kind == "LEG":
        t = kv["TYPE"]
        p = [get_s(kv["FROM"]), get_s(kv["TO"]), get_s(kv["T"]),
             card_num(kv.get("LAT", 0)), card_num(kv.get("LON", 0)), card_num(kv.get("ALT", 0)),
             card_num(kv.get("V", 0)), card_num(kv.get("FPA", 0)), card_num(kv.get("HDG", 0)),
             get_s(kv.get("TB", "0")), card_num(kv.get("LATB", 0)), card_num(kv.get("LONB", 0))]
        # LCONIC: DV= (ft/s) and its direction P= R= N= at T (mid-burn) on the
        # vehicle's previous leg, or (no DV=) a state T= LAT= LON= ALT= V= FPA=.
        lc = t == "LCONIC"
        p += [card_num(kv.get("DV", 0)), card_num(kv.get("P", 0)), card_num(kv.get("R", 0)),
              card_num(kv.get("N", 0)) if lc else 0.0,
              card_num(kv.get("ALTB", kv.get("ALT", 0)))]
        if lc and "DV" not in kv:
            for k in ("LAT", "LON", "ALT", "V", "FPA"):
                assert k in kv, f"{name}: LCONIC state needs {k}="
        legs.append({"m": cur["n"], "type": LEG_TYPES[t], "p": p,
                     "gc": LATTYPES[kv.get("LATTYPE", "GD")],
                     "veh": LEG_VEH[kv.get("VEH", "CSM")],
                     "n": 0 if lc else int(kv.get("N", 0)),
                     "src": f"{t}: " + kv.get("SRC", "")})
    elif kind in ("START", "REF"):
        p = [get_s(kv["T"]), get_s(kv.get("END", "0")), get_s(kv["T"]),
             card_num(kv["LAT"]), card_num(kv["LON"]), card_num(kv["ALT"]),
             card_num(kv["V"]), card_num(kv["FPA"]), card_num(kv.get("HDG", 0)), 0.0, 0.0, 0.0]
        p += [0.0] * (NLGP - len(p))
        sim["start" if kind == "START" else "ref"].append(
            {"m": cur["n"], "p": p, "gc": LATTYPES[kv.get("LATTYPE", "GD")],
             "body": {"EARTH": 1, "MOON": 2}[kv["BODY"]],
             "src": kind + ": " + kv.get("SRC", "")})
    elif kind == "BURN":
        sim["burn"].append({"m": cur["n"], "t": get_s(kv["T"]), "dv": card_num(kv["DV"]),
                            "dir": (card_num(kv["P"]), card_num(kv["R"]), card_num(kv["N"])),
                            "body": {"EARTH": 1, "MOON": 2}[kv["BODY"]],
                            "src": "BURN: " + kv.get("SRC", "")})
    elif kind == "TIMELINE":
        assert kv["KIND"] in TL_KINDS, f"{name}: TIMELINE KIND {kv['KIND']}"
        sim["tl"].append({"m": cur["n"], "t": get_s(kv["T"]), "kind": kv["KIND"],
                          "name": kv["NAME"], "src": kv.get("SRC", "")})
    elif kind == "BURNCUE":
        assert kv["VEH"] in BURN_VEH and kv["ENG"] in BURN_ENG, f"{name}: BURNCUE VEH= or ENG="
        sim["cue"].append({"m": cur["n"], "ign": kv["IGN"], "cut": kv["CUT"]})
    elif kind in SIT_CARDS:
        situation_card(name, kind, kv, cur, sim["sit"])
    elif kind == "SPAN":
        sim["span"].append({"m": cur["n"], "deck": str(name), "kv": kv})
    elif kind == "EVENT":
        evs.append({"m": cur["n"], "kind": EVENT_KINDS[kv["KIND"]], "t": get_s(kv["T"]),
                    "src": kv["KIND"] + ": " + kv.get("SRC", "")})
    else:
        raise AssertionError(f"{name}: {kind} card not valid in a scenario")
    return tab


# Situations (#17): SITUATION cards in a scenario deck, each followed by its RECIPE and VIEWS cards
# and, optionally, an HDRREF card.  A situation's ID is global (1..N across all decks) and is the
# kernel's scene number (view_init(scene)); its scenario is the deck it sits in.  The codes below are
# the card reader's vocabulary (vdvoc.f); the reader fills the situation tables (src/viewsit.inc),
# and SITSET in src/vdrive.f copies a row into /CSITU/.
SIT_CARDS = {"SITUATION", "RECIPE", "VIEWS", "HDRREF"}
LAYER_IDS = {"FRAME": 1, "STARS": 2, "SUN": 3, "MOON": 4, "EARTH": 5, "VEHICLES": 6, "COAS": 7,
             "SHADOW": 8, "LPD": 9, "BURN": 10}
MAXLAY = 12                                   # MXLAY of src/viewsit.inc: SILY(MXLAY, MXSIT)
GET_RULES = {"ERISE": 3}                      # named computed default times: ERFIND's TERISE
WINDOWS = {"CSM": 1, "LM": 2}                 # hdr(8): 1 CSM window, 2 LM front window
POSES = {"LMPIRO": 1, "S7POSE": 2, "S8POSE": 3}
DRAW_BITS = {"NOSHADE": 1, "MOONDISC": 2, "NOLMMARK": 4}
RECIPES = {"LOCALVERT": 1, "INERTIAL": 2, "CREWSTN": 3, "BODYCTR": 4, "EXTSEED": 5}
BODIES = {"EARTH": 1, "MOON": 2}
MODES = {"FORWARD": 1, "NORMAL": 2}
ATTS = {"SIGHTLINE": 1, "S7ATT": 2, "S8ATT": 3}
CREW_VEH = {"CM": 1, "LM": 2}
VIEWS_ = {"WINDOW": 0, "EXTERNAL": 1, "CM": 2, "LM": 3}
TARGETS = {"EARTH": 1, "MOON": 2, "SUN": 3, "CSM": 4, "LM": 5, "SIVB": 6}
RIDES = {"NONE": 0, "CSM": 1, "LM": 2}
STATION_RULES = {"NO": 0, "PLACED": 1, "ALWAYS": 2}
HDR_OBJS = {"BODY": 0, "LM": 1, "LMDOCK": 2, "CSMTUNNEL": 3}
AZ_RULES = {"NONE": 0, "EARTH": 1}           # LOCALVERT AZ=: none, or turned to the Earth's sightline
OFF_LEGS = {"EARTH": 1}                       # LOCALVERT OFFLEG=: the camera off the Moon's legs
YES_NO = {"NO": 0, "YES": 1}
FOV_RULES = {"DISC": 2}                       # FOV=DISC:f, the disc fills f of the frame (rule 1: degrees)
SIT_ORDER = ["RECIPE", "VIEWS", "HDRREF"]     # the cards after a SITUATION card, in this order
# The keys each recipe (and attitude source) takes; any other key on its RECIPE card is refused.
RECIPE_KEYS = {
    "LOCALVERT": {"BODY", "MODE", "AZ", "ELEV", "TURN", "OFFLEG", "OFFELEV"},
    ("INERTIAL", "SIGHTLINE"): {"ATT", "BODY", "AT", "FIX", "DRIFT", "ELOFF"},
    ("INERTIAL", "S7ATT"): {"ATT"},
    "CREWSTN": {"VEH"},
    "BODYCTR": {"BODY", "ALT"},
    "EXTSEED": {"ATT", "DIST"},
}


def enum(table, val, where, what):
    """A card's code word looked up in its table, refused with the words it may take."""
    assert val in table, f"{where}: {what}={val}: not one of {', '.join(map(str, table))}"
    return table[val]


def situation_card(name, kind, kv, cur, sits):
    """One SITUATION, RECIPE, VIEWS or HDRREF card of scenario cur into sits."""
    assert cur is not None, f"{name}: {kind} card before the SCENARIO card"
    if kind == "SITUATION":
        sits.append({"id": int(kv["ID"]), "m": cur["n"], "deck": str(name), "kv": kv, "seq": []})
        return
    assert sits and sits[-1]["m"] == cur["n"], f"{name}: {kind} card before its SITUATION card"
    t = sits[-1]
    want = SIT_ORDER[len(t["seq"])] if len(t["seq"]) < len(SIT_ORDER) else None
    assert kind == want, (f"{name}: situation {t['id']}: {kind} card out of order; after "
                          f"SITUATION come RECIPE, VIEWS and an optional HDRREF, once each")
    t["seq"].append(kind)
    t[kind] = kv


def get_rule(txt, evkinds):
    """GET= of a SITUATION card: a g.e.t. (literal), EVENT+offset or EVENT-offset (an EVENT card
    of the scenario), or a named rule (GET_RULES) with an offset.  Returns (kind, event code,
    seconds): kind 1 literal, 2 event, 3 Earthrise (ERFIND)."""
    m = re.fullmatch(r"([A-Z][A-Z0-9]*)(?:([+-])([^+-].*))?", txt)
    if not m:
        return 1, 0, get_s(txt)
    off = get_s(m.group(3)) if m.group(3) else 0.0
    off = -off if m.group(2) == "-" else off
    if m.group(1) in GET_RULES:
        return GET_RULES[m.group(1)], 0, off
    assert m.group(1) in EVENT_KINDS, f"GET={txt}: no event or rule {m.group(1)}"
    return 2, EVENT_KINDS[m.group(1)], off


def situations(mis, evs, sits):
    """Check the situation cards, situations 1..N.  Returns per situation what the page's lists
    read: id, m (its scenario), gk (its GET= rule's kind, get_rule), rcp (its recipe) and az (a
    LOCALVERT recipe's AZ= rule; 0 for the others)."""
    out = []
    seen = {}
    for t in sits:
        assert t["id"] not in seen, \
            f"{t['deck']}: situation {t['id']}: ID {t['id']} already used in {seen.get(t['id'])}"
        seen[t["id"]] = t["deck"]
    for t in sits:
        kv, where = t["kv"], f"{t['deck']}: situation {t['id']}"
        assert "RECIPE" in t and "VIEWS" in t, f"{where}: needs a RECIPE and a VIEWS card"
        rc, vw, hr = t["RECIPE"], t["VIEWS"], t.get("HDRREF", {"OBJ": "BODY"})
        evk = {e["kind"] for e in evs if e["m"] == t["m"]}
        gk, ge, _ = get_rule(kv["GET"], EVENT_KINDS)
        assert gk != 2 or ge in evk, f"{where}: GET={kv['GET']}: the scenario has no such EVENT"
        fov = kv["FOV"]
        assert fov.count(":") <= 1, f"{where}: FOV={fov}"
        disc = fov.startswith("DISC:")
        card_num(fov.split(":")[1] if disc else fov)
        look = kv.get("LOOK", "0,0,0").split(",")
        assert len(look) == 3, f"{where}: LOOK=yaw,pitch,roll"
        for x in look:
            card_num(x)
        enum(WINDOWS, kv["WINDOW"], where, "WINDOW")
        lay = [enum(LAYER_IDS, x, where, "LAYERS") for x in kv["LAYERS"].split(",")]
        assert len(lay) <= MAXLAY and len(set(lay)) == len(lay), f"{where}: LAYERS"
        pose = enum(POSES, kv["POSE"], where, "POSE") if "POSE" in kv else 0
        for x in kv["DRAW"].split(",") if "DRAW" in kv else ():
            enum(DRAW_BITS, x, where, "DRAW")
        # The recipe and its parameters.  Each recipe takes only the parameter values the kernel
        # has a code path for; anything else is refused here rather than drawn wrongly.
        rcp = enum(RECIPES, rc["NAME"], where, "RECIPE NAME")
        rkey = (rc["NAME"], rc.get("ATT")) if rc["NAME"] == "INERTIAL" else rc["NAME"]
        rkeys = enum(RECIPE_KEYS, rkey, where, "RECIPE NAME and ATT")
        extra = sorted(set(rc) - rkeys - {"NAME", "SRC"})
        assert not extra, f"{where}: RECIPE {rc['NAME']} takes no {', '.join(extra)}"
        az = offleg = 0
        if rcp == 1:
            bod = enum(BODIES, rc["BODY"], where, "BODY")
            mod = enum(MODES, rc["MODE"], where, "MODE")
            az = enum(AZ_RULES, rc.get("AZ", "NONE"), where, "AZ")
            card_num(rc.get("ELEV", "0"))
            if bod == 2:
                assert float(rc.get("ELEV", "0")) == 0, f"{where}: LOCALVERT about the Moon: ELEV=0 only"
                assert mod == 1 or az == 0, f"{where}: NORMAL takes no AZ="
            else:
                assert mod == 1 and az == 0, f"{where}: LOCALVERT about the Earth: FORWARD, no AZ="
            if "TURN" in rc:
                assert bod == 2 and mod == 1, f"{where}: TURN= on the Moon's FORWARD view only"
                turn = [card_num(x) for x in rc["TURN"].split(",")]
                assert len(turn) == 3, f"{where}: TURN=yaw,pitch,roll"
            if "OFFLEG" in rc:
                assert bod == 2 and rc["OFFLEG"] == "EARTH", f"{where}: OFFLEG=EARTH from the Moon only"
                offleg = 1
                card_num(rc["OFFELEV"])
        elif rcp == 2:
            att = enum(ATTS, rc["ATT"], where, "ATT")
            assert att in (1, 2), f"{where}: INERTIAL: ATT=SIGHTLINE or S7ATT"
            if att == 1:
                assert rc["BODY"] == "EARTH", f"{where}: INERTIAL SIGHTLINE: BODY=EARTH only"
                fe = enum(EVENT_KINDS, rc["AT"], where, "AT")
                assert fe in evk, f"{where}: AT={rc['AT']}: the scenario has no such EVENT"
                get_s(rc["FIX"])
                get_s(rc["DRIFT"])
                card_num(rc["ELOFF"])
        elif rcp == 3:
            veh = enum(CREW_VEH, rc["VEH"], where, "VEH")
            assert veh == 2, f"{where}: CREWSTN VEH=CM has no axes source yet (the CM station is in_view 2)"
            assert kv["WINDOW"] == "LM" and vw.get("RIDES") == "LM", \
                f"{where}: CREWSTN VEH=LM goes with WINDOW=LM and RIDES=LM"
        elif rcp == 4:
            assert rc["BODY"] == "MOON", f"{where}: BODYCTR: BODY=MOON only"
            card_num(rc["ALT"])
        else:
            assert rc["ATT"] == "S8ATT", f"{where}: EXTSEED: ATT=S8ATT only"
            card_num(rc["DIST"])
        assert not disc or rcp == 4, f"{where}: FOV=DISC: needs BODYCTR"
        # The Earthrise time comes from ERFIND, which VINIT runs only for an Earth-sightline
        # azimuth.
        assert gk != 3 or (rcp == 1 and az == 1), \
            f"{where}: GET={kv['GET']}: the Earthrise rule needs RECIPE LOCALVERT AZ=EARTH"
        # View rules.
        enum(VIEWS_, vw.get("VIEW", "WINDOW"), where, "VIEW")
        enum(TARGETS, vw["TARGET"], where, "TARGET")
        tgf = enum(TARGETS, vw["OFFTARGET"], where, "OFFTARGET") if "OFFTARGET" in vw else 0
        assert (tgf != 0) == (offleg == 1), f"{where}: OFFTARGET= goes with the recipe's OFFLEG="
        enum(RIDES, vw["RIDES"], where, "RIDES")
        enum(STATION_RULES, vw["CM"], where, "CM")
        enum(STATION_RULES, vw["LM"], where, "LM")
        enum(YES_NO, vw.get("FIXED", "NO"), where, "FIXED")
        if "XSTART" in vw:
            xy = [card_num(x) for x in vw["XSTART"].split(",")]
            assert len(xy) == 2, f"{where}: XSTART=yaw,pitch"
        # Header reference object.
        hk = enum(HDR_OBJS, hr["OBJ"], where, "HDRREF OBJ")
        card_num(hr.get("OFFSET", "0"))
        card_num(hr.get("RADIUS", "0"))
        assert hk != 2 or pose == POSES["S7POSE"], f"{where}: HDRREF OBJ=LMDOCK needs POSE=S7POSE"
        assert hk != 3 or pose == POSES["S8POSE"], f"{where}: HDRREF OBJ=CSMTUNNEL needs POSE=S8POSE"
        out.append({"id": t["id"], "m": t["m"], "gk": gk, "rcp": rcp, "az": az})
    out.sort(key=lambda r: r["id"])
    assert [r["id"] for r in out] == list(range(1, len(out) + 1)), "situation ids must be 1..N"
    assert {r["m"] for r in out} <= {m["n"] for m in mis}
    return out


# The page's copy of the situations and of each scenario's SPAN cards (#17), in build/names.js:
# VIEW_NAMES.SITUATIONS (in id order) and VIEW_NAMES.SCENARIOS.  The page reads these and holds no
# list of its own (docs/systems-model.md, section 4, rules 3 and 4).
JD_UNIX = 2440587.5   # JD of 1970-01-01 00:00 UTC, the page's Date origin
SPAN_KEYS = {"FOLLOW": {"VIEW", "TARGET", "FOV", "CAPTION"}, "LIVE": set(), "JUMP": set(), "PIN": set()}   # optional
SPAN_NEED = {"FOLLOW": {"SIT", "UNTIL"}, "LIVE": {"SIT", "UNTIL", "NAME"},                         # required
             "JUMP": {"SIT", "FROM", "LEN", "BUTTON"}, "PIN": {"SIT"}}


def event_times(evs, m):
    """Scenario m's EVENT cards as {event code: g.e.t. s}."""
    return {e["kind"]: e["t"] for e in evs if e["m"] == m}


def static_get(txt, evt, where):
    """A g.e.t. on a card: h:mm:ss (or s) or EVENT+-offset, resolved with the scenario's EVENT
    cards; None for END.  Rounded to the millisecond, as the cards' times are."""
    if txt == "END":
        return None
    try:
        gk, ge, gt = get_rule(txt, EVENT_KINDS)
    except (AssertionError, ValueError) as e:
        raise AssertionError(f"{where}: {e}") from None
    assert gk in (1, 2), f"{where}: {txt}: a g.e.t. or an EVENT plus or minus an offset"
    assert gk == 1 or ge in evt, f"{where}: {txt}: the scenario has no such EVENT"
    return round(gt + (evt[ge] if gk == 2 else 0.0), 3)


def page_situations(sits, raw, mis, evs):
    """VIEW_NAMES.SITUATIONS: what the page needs of each situation, from its cards.  get is the
    default g.e.t. where the cards fix it (None for a computed rule, get_rule); fov None for a
    DISC: field (fov_rule)."""
    card = {t["id"]: t for t in raw}
    mname = {m["n"]: m["mname"] for m in mis}
    out = []
    for r in sits:
        t = card[r["id"]]
        kv, rc, vw = t["kv"], t["RECIPE"], t["VIEWS"]
        where = f"{t['deck']}: situation {r['id']}"
        assert "TITLE" in kv, f"{where}: needs TITLE= (the page's name for it)"
        o = {"id": r["id"], "name": kv["NAME"], "title": kv["TITLE"], "scenario": r["m"],
             "mission": mname[r["m"]], "get_rule": kv["GET"],
             "get": None if r["gk"] == 3 else static_get(kv["GET"], event_times(evs, r["m"]), where),
             "fov": None if kv["FOV"].startswith("DISC:") else float(kv["FOV"]),
             "fov_rule": kv["FOV"], "view": vw.get("VIEW", "WINDOW"), "target": vw["TARGET"],
             "stations": {"cm": vw["CM"], "lm": vw["LM"]}, "fixed": vw.get("FIXED", "NO") == "YES",
             "recipe": rc["NAME"], "pose": kv.get("POSE", "")}
        if "CAPTION" in kv:
            o["caption"] = kv["CAPTION"]
        out.append(o)
    return out


def page_scenarios(mis, legs, evs, spans, sits):
    """VIEW_NAMES.SCENARIOS: per scenario its mission, its epoch (s from scenario 1's range zero, as
    hdr(16)), its range zero as UTC ms (zero: the page's and the room's clocks; the EPOCH card's JD to
    the whole second, since every EPOCH card's source gives range zero to the second and six decimals
    of a day are 0.0864 s) and its SPAN cards by track.  follow: [until, situation, in_view, in_target, field],
    until None for END, field None for the situation's own, and a sixth item, the caption, where the card has
    CAPTION=; live: [until, situation, name]; jump:
    {scene, get, len, button}; pin: situation ids.  Every span time lies within the scenario's
    legs; LIVE cards are in exactly one scenario (the one Live follows)."""
    sit_m = {r["id"]: r["m"] for r in sits}
    jd1 = next(m["jd"] for m in mis if m["n"] == 1)
    out = {}
    for m in mis:
        evt = event_times(evs, m["n"])
        ml = [lg["p"] for lg in legs if lg["m"] == m["n"]]
        t0, t1 = min(q[0] for q in ml), max(q[1] for q in ml)
        tr = {"follow": [], "live": [], "jump": [], "pin": []}
        for k, c in enumerate(x for x in spans if x["m"] == m["n"]):
            kv, where = c["kv"], f"{c['deck']}: SPAN {k + 1}"
            track = enum({t: t for t in SPAN_KEYS}, kv.get("TRACK", ""), where, "TRACK")
            extra = sorted(set(kv) - SPAN_KEYS[track] - SPAN_NEED[track] - {"TRACK", "SRC"})
            assert not extra, f"{where}: TRACK={track} takes no {', '.join(extra)}"
            miss = sorted(SPAN_NEED[track] - set(kv))
            assert not miss, f"{where}: TRACK={track} needs {', '.join(k + '=' for k in miss)}"

            def num(key, conv=float):
                try:
                    return conv(kv[key])
                except ValueError:
                    raise AssertionError(f"{where}: {key}={kv[key]}: not a number") from None

            def when(key):
                t = static_get(kv[key], evt, f"{where}: {key}")
                assert t is None or t0 <= t <= t1, \
                    f"{where}: {key}={kv[key]} ({t} s) is outside the scenario's legs, {t0} to {t1} s"
                return t
            sid = num("SIT", int)
            assert sit_m.get(sid) == m["n"], f"{where}: SIT={sid} is not a situation of this scenario"
            if track in ("FOLLOW", "LIVE"):
                until = when("UNTIL")
                prev = tr[track.lower()]
                assert not prev or (prev[-1][0] is not None and (until is None or until > prev[-1][0])), \
                    f"{where}: {track} spans in g.e.t. order, END last"
            if track == "FOLLOW":
                tr["follow"].append([until, sid, enum(VIEWS_, kv.get("VIEW", "WINDOW"), where, "VIEW"),
                                     enum(TARGETS, kv["TARGET"], where, "TARGET") if "TARGET" in kv else 0,
                                     num("FOV") if "FOV" in kv else None] + ([kv["CAPTION"]] if "CAPTION" in kv else []))
            elif track == "LIVE":
                tr["live"].append([until, sid, kv["NAME"]])
            elif track == "JUMP":
                g, n = when("FROM"), num("LEN")
                assert g is not None, f"{where}: FROM=END"
                assert n > 0, f"{where}: LEN={kv['LEN']}: must be more than 0"
                assert g + n <= t1, f"{where}: FROM+LEN ({g + n} s) is past the scenario's legs, {t1} s"
                tr["jump"].append({"scene": sid, "get": g, "len": n, "button": kv["BUTTON"]})
            else:
                assert sid not in tr["pin"], f"{where}: SIT={sid} is already pinned"
                tr["pin"].append(sid)
        for t in ("follow", "live"):
            assert not tr[t] or tr[t][-1][0] is None, f"scenario {m['n']}: the last {t.upper()} span ends at END"
        out[str(m["n"])] = {"mission": m["mname"], "epoch": round((m["jd"] - jd1) * 86400, 3),
                            "zero": round((m["jd"] - JD_UNIX) * 86400) * 1000, "spans": tr}
    live = [k for k, v in out.items() if v["spans"]["live"]]
    assert len(live) == 1, f"LIVE spans: Live follows one scenario, found them in {len(live)} ({', '.join(live)})"
    return out


# Playlist reels (#18): data/reels/<id>/run.scn, a REEL card and its SHOT cards in playing order
# (the format: data/reels/demo/run.scn's header).  The page's copy is VIEW_NAMES.REELS in
# build/names.js, which the playlist player (web/src/player.js) reads; the kernel never reads them.
# Every shot names a situation by its ID and an absolute g.e.t., never an offset from the
# situation's default, so retuning a default does not move a shot.  The one time computed at run
# time is ERFIND's Earthrise (ERISE+-offset), which the kernel exports as out_terise.
REEL_NEED = {"ID", "TITLE", "KIND", "ALIAS"}
REEL_MODES = {"LIVE", "FREE", "BEAM"}   # the page's other modes: no reel may take their name
SHOT_NEED = {"SIT", "NAME", "DUR"}
SHOT_LAWS = ({"GET", "RATE"}, {"GET", "TO"}, {"AT", "TTE"})   # the time laws: exactly one
LOOK_LAWS = {"LIN", "SIN", "HAV"}   # a + (b - a) u; a + b sin(2 pi u); a + (b - a) (1 - cos(2 pi u)) / 2
FLAGS = {"YES": True, "NO": False}


def page_reels(mis, legs, evs, sits):
    """VIEW_NAMES.REELS: {id: {id, title, alias, next, fade, film, tag, shots}} from
    data/reels/*/run.scn.  Each shot: name, sit, dur (s), get [from, to] (g.e.t. s at the shot's
    start and end, linear between; with rule "ERISE" both are offsets from the kernel's Earthrise,
    out_terise) or at and tte (the entry interface's g.e.t. and [u, s to it] rows,
    log-interpolated), lab (0 or 3), frame, view (0..3), and where its cards name them target, cap,
    fov, yaw, pitch, roll (a number, or [law, a, b] in the shot fraction u) and limb ([u, deg])."""
    sit = {r["id"]: r for r in sits}
    span = {}
    for m in mis:
        ml = [lg["p"] for lg in legs if lg["m"] == m["n"]]
        span[m["n"]] = (min(q[0] for q in ml), max(q[1] for q in ml))
    out = {}
    rdir = D / "reels"
    for path in sorted(rdir.glob("*/run.scn")) if rdir.is_dir() else []:
        deck, folder = path.relative_to(D), path.parent.name
        reel, shots = None, []
        for kind, kv in cards(path):
            if kind == "*END":
                break
            where = f"{deck}: {kind}" if kind != "SHOT" else \
                f"{deck}: SHOT {len(shots) + 1}" + (f" ({kv['NAME']})" if "NAME" in kv else "")

            def num(txt, key):
                try:
                    v = float(txt)
                except ValueError:
                    raise AssertionError(f"{where}: {key}={txt}: not a number") from None
                assert math.isfinite(v), f"{where}: {key}={txt}: not a finite number"
                return v
            if kind == "REEL":
                assert reel is None, f"{deck}: one REEL card per deck"
                miss = sorted(REEL_NEED - set(kv))
                assert not miss, f"{where} needs {', '.join(k + '=' for k in miss)}"
                assert kv["KIND"] == "PLAYLIST", f"{where} KIND={kv['KIND']}: only PLAYLIST so far"
                assert kv["ID"].lower() == folder, f"{where} ID={kv['ID']}: the folder is {folder}"
                assert kv["ALIAS"].upper() not in REEL_MODES, \
                    f"{where} ALIAS={kv['ALIAS']}: that is one of the page's modes ({', '.join(sorted(REEL_MODES))})"
                fade = num(kv.get("FADE", "0"), "FADE")
                assert fade >= 0, f"{where} FADE={kv['FADE']}: must not be negative"
                reel = {"id": folder, "title": kv["TITLE"], "alias": kv["ALIAS"].lower(),
                        "next": kv["NEXT"].lower() if "NEXT" in kv else None, "fade": fade,
                        "film": enum(FLAGS, kv.get("FILM", "NO"), where, "FILM"), "tag": kv.get("TAG", ""),
                        "shots": shots}
                continue
            assert kind == "SHOT", f"{deck}: {kind} card in a playlist reel (REEL and SHOT only)"
            assert reel is not None, f"{deck}: SHOT card before the REEL card"
            miss = sorted(SHOT_NEED - set(kv))
            assert not miss, f"{where}: needs {', '.join(k + '=' for k in miss)}"

            def table(key):
                rows = [q.split(":") for q in kv[key].split(",")]
                assert all(len(q) == 2 for q in rows), f"{where}: {key}=u:value,u:value,..."
                rows = [[num(u, key), num(v, key)] for u, v in rows]
                us = [q[0] for q in rows]
                assert len(rows) >= 2 and us[0] == 0 and us[-1] == 1 and us == sorted(set(us)), \
                    f"{where}: {key}: u rising from 0 to 1"
                return rows

            def when(key):
                """A g.e.t. on the shot: (rule, seconds); rule "ERISE" for ERFIND's Earthrise
                plus an offset (the seconds are that offset), else "" and the g.e.t."""
                txt = kv[key]
                gk, _, off = get_rule(txt, EVENT_KINDS) if re.fullmatch(r"ERISE(?:[+-].+)?", txt) else (0, 0, 0)
                if gk == GET_RULES["ERISE"]:
                    # As situations() checks for a SITUATION card: the Earthrise is ERFIND's,
                    # which VINIT runs only for a LOCALVERT view turned to the Earth's sightline.
                    assert s["rcp"] == 1 and s["az"] == 1, \
                        f"{where}: {key}={txt}: situation {sid} runs no Earthrise search (RECIPE LOCALVERT AZ=EARTH)"
                    return "ERISE", round(off, 3)
                t = static_get(txt, evt, f"{where}: {key}")
                assert t is not None, f"{where}: {key}=END"
                return "", t
            try:
                sid = int(kv["SIT"])
            except ValueError:
                raise AssertionError(f"{where}: SIT={kv['SIT']}: not a situation ID") from None
            assert sid in sit, f"{where}: SIT={sid}: no such situation (the SITUATION cards' IDs)"
            s = sit[sid]
            evt, (t0, t1) = event_times(evs, s["m"]), span[s["m"]]
            dur = num(kv["DUR"], "DUR")
            assert dur > 0, f"{where}: DUR={kv['DUR']}: must be more than 0"
            laws = [law for law in SHOT_LAWS if law <= set(kv)]
            assert len(laws) == 1 and not (set().union(*SHOT_LAWS) - laws[0]) & set(kv), \
                f"{where}: one time law: GET= with RATE= or TO=, or AT= with TTE="
            sh = {"name": kv["NAME"], "sit": sid, "dur": dur}
            rule = ""
            if "TTE" in kv:
                rule, at = when("AT")
                assert not rule, f"{where}: AT={kv['AT']}: a g.e.t. or an EVENT plus or minus an offset"
                sh["at"], sh["tte"] = at, table("TTE")
                assert all(q[1] > 0 for q in sh["tte"]), f"{where}: TTE: seconds to AT, more than 0"
                g = [at - sh["tte"][0][1], at - sh["tte"][-1][1]]
            else:
                rule, g0 = when("GET")
                if "RATE" in kv:
                    g = [g0, round(g0 + num(kv["RATE"], "RATE") * dur, 3)]
                else:
                    rule1, g1 = when("TO")
                    assert rule1 == rule, f"{where}: GET= and TO= from the same origin (both ERISE, or neither)"
                    g = [g0, g1]
                assert g[1] >= g[0], f"{where}: it ends ({g[1]} s) before it starts ({g[0]} s)"
                if rule:
                    sh["rule"] = rule
                sh["get"] = g
            if not rule:   # an ERISE shot's times are known at run time only: the selftest checks those
                for k, t in zip(("start", "end"), g):
                    assert t0 <= t <= t1, \
                        f"{where}: its {k} ({t} s) is outside situation {sid}'s scenario, {t0} to {t1} s"
            sh["lab"] = 3 if enum(FLAGS, kv.get("LABELS", "NO"), where, "LABELS") else 0
            sh["frame"] = enum(FLAGS, kv.get("FRAME", "NO"), where, "FRAME")
            sh["view"] = enum(VIEWS_, kv.get("VIEW", "WINDOW"), where, "VIEW")
            if "TARGET" in kv:
                sh["target"] = enum(TARGETS, kv["TARGET"], where, "TARGET")
            if enum(FLAGS, kv.get("CAPTION", "NO"), where, "CAPTION"):
                sh["cap"] = True
            if "FOV" in kv:
                sh["fov"] = num(kv["FOV"], "FOV")
                assert 0 < sh["fov"] < 180, f"{where}: FOV={kv['FOV']}: between 0 and 180 deg"
            for key in ("YAW", "PITCH", "ROLL"):
                if key not in kv:
                    continue
                law, _, ab = kv[key].partition(":")
                if not ab:
                    sh[key.lower()] = num(law, key)
                    continue
                enum({x: x for x in sorted(LOOK_LAWS)}, law, where, key + " law")
                ab = ab.split(",")
                assert len(ab) == 2, f"{where}: {key}={law}:a,b"
                sh[key.lower()] = [law, num(ab[0], key), num(ab[1], key)]
            if "LIMB" in kv:
                sh["limb"] = table("LIMB")
            shots.append(sh)
        assert reel is not None, f"{deck}: no REEL card"
        assert shots, f"{deck}: no SHOT cards"
        out[folder] = reel
    for r in out.values():
        assert r["next"] is None or r["next"] in out, f"reels/{r['id']}: NEXT={r['next']}: no such reel"
    aliases = [r["alias"] for r in out.values()]
    assert len(set(aliases)) == len(aliases), f"reels: ALIAS used twice ({', '.join(aliases)})"
    return out


# The card reader's vocabulary (src/vdeck.f, #26): every word a deck may hold, as character codes
# in BLOCK DATA VDVOCB (src/vdvoc.f), from the tables above, so the reader and this script read
# one list.  Each list is a PARAMETER (its number in VOCLST); a card kind's code is its PARAMETER
# Q + the first five letters, a key's Y + the first five.
def vocab_lists():
    keys = []
    for ks in CARD_KEYS.values():
        keys += [k for k in sorted(ks) if k not in keys]
    return [("VCARD", "card kinds", {c: i + 1 for i, c in enumerate(CARD_KEYS)}, "Q"),
            ("VKEY", "keys", {k: i + 1 for i, k in enumerate(keys)}, "Y"),
            ("VLEGT", "LEG TYPE=", LEG_TYPES, None), ("VLVEH", "LEG VEH=", LEG_VEH, None),
            ("VLATT", "LATTYPE=", LATTYPES, None), ("VVEL", "ROW VEL=", ROW_VELS, None),
            ("VEVK", "EVENT KIND= (and GET=, AT=)", EVENT_KINDS, None),
            ("VTLK", "TIMELINE KIND=", TL_KINDS, None), ("VBODY", "BODY=", BODIES, None),
            ("VBVEH", "BURNCUE VEH=", BURN_VEH, None), ("VBENG", "BURNCUE ENG=", BURN_ENG, None),
            ("VGRUL", "GET= rules", GET_RULES, None), ("VFOVR", "FOV= rules", FOV_RULES, None),
            ("VWIN", "WINDOW=", WINDOWS, None), ("VLAYR", "LAYERS=", LAYER_IDS, None),
            ("VPOSE", "POSE=", POSES, None), ("VDRAW", "DRAW= (bits)", DRAW_BITS, None),
            ("VRCP", "RECIPE NAME=", RECIPES, None), ("VMODE", "MODE=", MODES, None),
            ("VAZ", "AZ=", AZ_RULES, None), ("VOFFL", "OFFLEG=", OFF_LEGS, None),
            ("VATT", "ATT=", ATTS, None), ("VCRV", "RECIPE VEH=", CREW_VEH, None),
            ("VVIEW", "VIEW=", VIEWS_, None), ("VTGT", "TARGET=, OFFTARGET=", TARGETS, None),
            ("VRIDE", "RIDES=", RIDES, None), ("VSTN", "CM=, LM=", STATION_RULES, None),
            ("VYN", "FIXED=", YES_NO, None), ("VHDR", "HDRREF OBJ=", HDR_OBJS, None)]


def write_vocab():
    """src/vdvoc.inc (the list numbers, card and key codes, and /CDVOC/) and src/vdvoc.f (BLOCK
    DATA VDVOCB): word W of the vocabulary is VOCC(VOCS(W)) .. VOCC(VOCS(W)+VOCN(W)-1), with the
    value VOCV(W); list L holds words VOCLST(L) .. VOCLST(L+1)-1."""
    lists = vocab_lists()
    codes, start, length, value, lstart, notes = [], [], [], [], [], []
    for i, (_, what, table, _) in enumerate(lists):
        lstart.append(len(start) + 1)
        notes += comment_wrap(f"{i + 1}. {what}: " + ", ".join(table), lead="C     ")
        for w, v in table.items():
            start.append(len(codes) + 1); length.append(len(w)); value.append(v)
            codes += [ord(ch) for ch in w]
    lstart.append(len(start) + 1)
    names = [nm for nm, *_ in lists]
    consts = []
    for nm, _, table, pre in lists:
        if pre:
            consts += [(pre + w.replace("-", "")[:5], v) for w, v in table.items()]
    keys = lists[1][2]
    cardid = lists[0][2]
    assert list(cardid.values()) == list(range(1, len(cardid) + 1)) and len(cardid) <= 31, \
        "card kinds: codes 1..N, 31 at most (KYCARD's bits)"
    assert list(keys.values()) == list(range(1, len(keys) + 1)), "keys: codes 1..N"
    kycard = [sum(2 ** (cardid[c] - 1) for c, ks in CARD_KEYS.items() if k in ks) for k in keys]
    allnames = names + [c for c, _ in consts]
    assert len(set(allnames)) == len(allnames), "vocabulary PARAMETER names collide"
    inc = ["C     Generated by tools/gen_data.py from its card tables.  Do not edit.",
           "C     The card reader's vocabulary (src/vdeck.f; layout in",
           "C     tools/gen_data.py write_vocab): the lists, their numbers in",
           "C     VOCLST, and the codes of the card kinds (Q...) and keys (Y...).",
           "      INTEGER NVOCC, NVOCW, NVOCL",
           "C     RESTOMOD BEGIN: parenthesised PARAMETER list is FORTRAN 77 (1978)",
           f"      PARAMETER (NVOCC={len(codes)}, NVOCW={len(start)}, NVOCL={len(lists)})",
           "      INTEGER NVOCK",
           f"      PARAMETER (NVOCK={len(keys)})"]
    for i in range(0, len(names), 5):
        part = names[i:i + 5]
        inc += ["      INTEGER " + ", ".join(part),
                "      PARAMETER (" + ", ".join(f"{n}={i + j + 1}" for j, n in enumerate(part)) + ")"]
    for i in range(0, len(consts), 4):
        part = consts[i:i + 4]
        inc += ["      INTEGER " + ", ".join(c for c, _ in part),
                "      PARAMETER (" + ", ".join(f"{c}={v}" for c, v in part) + ")"]
    inc += ["C     RESTOMOD END",
            "      INTEGER VOCC(NVOCC), VOCS(NVOCW), VOCN(NVOCW), VOCV(NVOCW)",
            "C     KYCARD(K): the card kinds that take key K, bit Q-1 for kind Q.",
            "      INTEGER VOCLST(NVOCL+1), KYCARD(NVOCK)",
            "      COMMON /CDVOC/ VOCC, VOCS, VOCN, VOCV, VOCLST, KYCARD"]
    for ln in inc:
        assert len(ln) <= 72, ln
    (R / "src" / "vdvoc.inc").write_text("\n".join(inc) + "\n")
    b = ["C     Generated by tools/gen_data.py from its card tables.  Do not edit.",
         "C     The card reader's vocabulary, layout in vdvoc.inc.  Lists:"] + notes + [
         "C     RESTOMOD BEGIN: implied-DO DATA not found in FORTRAN V docs;",
         "C     the 1108 loader skips unreferenced BLOCK DATA",
         "C     (docs/univac-1108.md); ASCII codes, not FIELDATA.",
         "      BLOCK DATA VDVOCB",
         "      INCLUDE 'vdvoc.inc'",
         "      INTEGER IVD"]
    body = "\n".join(b) + "\n"
    for arr, vals in (("VOCC", codes), ("VOCS", start), ("VOCN", length), ("VOCV", value),
                      ("VOCLST", lstart), ("KYCARD", kycard)):
        body += fdata(arr, vals, "%d", 6 if arr == "KYCARD" else 10, iv="IVD")
    body += "      END\nC     RESTOMOD END\n"
    for ln in body.splitlines():
        assert len(ln) <= 72, ln
    (R / "src" / "vdvoc.f").write_text(body)


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


def fdata(arr, vals, fmt, per=5, chunk=95, iv="IBD"):
    """Fixed-form DATA statements for arr(1..n), chunk values per statement, iv the implied DO's
    variable (LFortran makes it a global symbol, so each BLOCK DATA needs its own).

    Each statement stays within 19 continuation lines (the FORTRAN 77 limit) and
    72 columns, so any period compiler would take it."""
    if not vals:
        return ""
    out = []
    for k in range(0, len(vals), chunk):
        part = vals[k:k + chunk]
        lines = [f"      DATA ({arr}({iv}),{iv}={k + 1},{k + len(part)}) /"]
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
    ncue = burn_cues(sim)
    ns, npt, nln, ncr = len(sx), len(clon), len(coast), len(crat)
    inc = ["C     Generated by tools/gen_data.py from data/. Do not edit.",
           "C     Catalog sizes shared by the kernel (src/*.f) and its BLOCK DATA.",
           "      INTEGER NSTAR, NNAV, NCPT, NCST, NCRAT, NMARE",
           "C     RESTOMOD BEGIN: parenthesised PARAMETER list is FORTRAN 77",
           "C     (1978); FORTRAN V wrote PARAMETER I = 2 (UP-4046 sec. 10.4.1)",
           f"      PARAMETER (NSTAR={ns}, NNAV=37, NCPT={npt}, NCST={nln})",
           f"      PARAMETER (NCRAT={ncr}, NMARE={len(mar)})",
           "C     RESTOMOD END",
           "C     The run decks' codes (their tables are in viewcom.inc, filled by",
           "C     the card reader, vdeck.f): NLGP parameters a leg, leg types and",
           "C     event kinds.",
           "      INTEGER NLGP",
           "      INTEGER KCIRC, KCONIC, KLUNAR, KLCON, KTABL",
           *["      INTEGER " + ", ".join(list(EVENT_PARAMS.values())[i:i + 8])
             for i in range(0, len(EVENT_PARAMS), 8)],
           "C     RESTOMOD BEGIN: parenthesised PARAMETER list is FORTRAN 77",
           f"      PARAMETER (NLGP={NLGP})",
           "      PARAMETER (" + ", ".join(f"K{k}={v}" for k, v in
                                        (("CIRC", 1), ("CONIC", 2), ("LUNAR", 3),
                                         ("LCON", 4), ("TABL", 5))) + ")",
           *["      PARAMETER (" + ", ".join(f"{EVENT_PARAMS[k]}={v}" for k, v in
                                         list(EVENT_KINDS.items())[i:i + 4]) + ")"
             for i in range(0, len(EVENT_KINDS), 4)],
           "C     RESTOMOD END"]
    for ln in inc:
        assert len(ln) <= 72, ln
    (R / "src" / "viewdims.inc").write_text("\n".join(inc) + "\n")

    b = ["C     Generated by tools/gen_data.py from data/. Do not edit.",
         "C     The static catalogs.  The run tables (scenarios, situations) are",
         "C     the card reader's (vdeck.f), filled from the run decks.",
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
         "C     /CMEEUS/ Meeus ch. 47 lunar terms, flattened: MMA(6*(K-1)+1..6)",
         "C              = D M M' F sigma_l sigma_r of table 47.A row K,",
         "C              MMB(5*(K-1)+1..5) = D M M' F sigma_b of table 47.B.",
         "      INTEGER MMA(360), MMB(300)",
         "      COMMON /CMEEUS/ MMA, MMB"]
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
    # The landing site lettered in scene 6 (kind 7), SITECH: the one mission whose SITE card names
    # it; the card reader fills it.
    site = sorted({m["sitename"] for m in mis if m["sitename"]})
    assert len(site) <= 1 and all(len(x) <= 22 for x in site), f"one SITE NAME= of 22 characters at most: {site}"
    mrch = []
    for m in mar:
        nm = m[3][:24]
        mrch += [ord(ch) for ch in nm] + [0] * (24 - len(nm))
    body += fdata("MRLAT", [m[0] for m in mar], f3, 5)
    body += fdata("MRLON", [m[1] for m in mar], f3, 5)
    body += fdata("MRDIA", [m[2] for m in mar], f1, 6)
    body += fdata("MRCH", mrch, "%d", 10)
    body += fdata("MMA", [v for r_ in m47a for v in r_], "%d", 6)
    body += fdata("MMB", [v for r_ in m47b for v in r_], "%d", 5)
    body += "      END\nC     RESTOMOD END\n"
    (R / "src" / "viewdata.f").write_text(body)

    # Names for labels: crater names only for the larger primary craters.
    # NAV_MAG: magnitude of the 354th brightest non-named star (37 named + 354 = 391), the limit for the approximated 391-star navigation
    # catalog (TN D-6853 p.12); the page draws only stars at or brighter than this in its NAV catalog.
    nav_mag = round(sorted(s[1] for s in stars)[391 - 37 - 1], 2)
    # CRATER_KM: each crater's diameter (km), in CRATER's order, so the page can apply the
    # secondary label level's 25 km cut to the names it letters.
    names = {"NAV": NAV_NAMES, "NAV_MAG": nav_mag,
             "CRATER": [c[3] if (c[4] == "AA" and c[2] >= 20) else "" for c in crat],
             "CRATER_KM": [round(c[2], 1) for c in crat],
             # Each scenario's timeline (TIMELINE cards) for chapter marks: g.e.t. (s from that
             # scenario's range zero; hdr(16) gives its offset from Apollo 11's), kind, name.
             "TIMELINE": {str(m["n"]): {"name": m["name"],
                                        "events": [[round(r["t"], 3), r["kind"], r["name"]]
                                                   for r in sorted(sim["tl"], key=lambda r: r["t"])
                                                   if r["m"] == m["n"]]}
                          for m in mis},
             "TL_KINDS": list(TL_KINDS)}
    sits = situations(mis, evs, sim["sit"])
    # The situations and each scenario's SPAN cards: the page's only copy of them.
    names["SITUATIONS"] = page_situations(sits, sim["sit"], mis, evs)
    names["SCENARIOS"] = page_scenarios(mis, legs, evs, sim["span"], sits)
    # The playlist reels (REEL and SHOT cards, data/reels/*/run.scn): the page's only copy.
    names["REELS"] = page_reels(mis, legs, evs, sits)
    (R / "build").mkdir(exist_ok=True)
    (R / "build" / "names.js").write_text("const VIEW_NAMES = " + json.dumps(names) + ";\n")
    write_vocab()
    # The decks in load order (the order above: missions by folder, each mission.scn and then its
    # scenarios), for the card reader's gates: tools/golden.sh and the selftest load them.
    order = []
    for mdir in sorted(p for p in (D / "missions").iterdir() if p.is_dir()):
        order += [mdir / "mission.scn"] + sorted(p for p in mdir.glob("*.scn")
                                                 if p.name != "mission.scn")
    (R / "build" / "decks.txt").write_text("".join(f"{p.relative_to(R)}\n" for p in order))
    # The scene list make check and the selftest read: situation ids and their scenarios.
    (R / "build" / "scenes.json").write_text(json.dumps(
        {"scenes": [t["id"] for t in sits], "scenario": {str(t["id"]): t["m"] for t in sits}}) + "\n")
    print(f"stars {len(sx)} (nav 37), coast {len(coast)} lines / {len(clon)} pts, "
          f"craters {len(crat)}, scenarios {len(mis)} ({len(legs)} legs, {len(evs)} events, "
          f"{len(sim['start'])} start, {len(sim['burn'])} burns, {len(sim['ref'])} reference rows, "
          f"{len(sim['tl'])} timeline rows, {ncue} burn cues), situations {len(sits)}")
    for i in (4, 12, 29):
        x, y, z = nav[i]
        print(f"  check {NAV_NAMES[i]}: RA {math.degrees(math.atan2(y, x)) % 360:.2f} "
              f"Dec {math.degrees(math.asin(z)):.2f}  mag {navmag[i]}")


if __name__ == "__main__":
    main()
