#!/usr/bin/env python3
"""Symbol table of the fixed-form kernel (src/*.f, src/viewcom.inc, src/viewdims.inc) -> build/symbols.json.

For the page's source browser.  Per file: path, kind (Driver, Dispatcher, Core, Layer N, Data from the ELEMENTS
list in the header of src/vdrive.f; Include for the .inc files), line count, leading comment block, units.  Per program unit (SUBROUTINE, FUNCTION, BLOCK DATA, ENTRY): name, kind, file, lines,
args, declared variables (type, dims, arg or COMMON), COMMON blocks used (a block counts when the unit
references one of its members; `includes` says whether viewcom.inc brings them all in), PARAMETERs and intrinsics referenced, calls (CALL and references to kernel
functions), called-by, RESTOMOD fences, the comment block above the header (else just below it) as doc, and a statement outline
(DO loops, block IFs, GO TOs, CALLs, RETURN/STOP, labels; see outline()).
Globals: COMMON blocks with members and the units that reference each; PARAMETERs with values.
viewdata.f (generated, large) gets its unit list and the COMMON blocks it initialises only.

Usage: gen_symbols.py [out.json]   (default build/symbols.json)
"""
import json, pathlib, re, sys

R = pathlib.Path(__file__).resolve().parent.parent
SRC = R / "src"
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else R / "build/symbols.json"

KEYWORDS = set("""IF THEN ELSE ELSEIF END ENDIF DO CONTINUE GO TO GOTO RETURN CALL STOP PAUSE DATA PARAMETER
COMMON INCLUDE DIMENSION EXTERNAL INTRINSIC IMPLICIT DOUBLE PRECISION INTEGER REAL LOGICAL CHARACTER COMPLEX
FUNCTION SUBROUTINE ENTRY BLOCK SAVE EQUIVALENCE WRITE READ FORMAT PRINT OPEN CLOSE REWIND""".split())
INTRINSICS = set("""DSIN DCOS DTAN DASIN DACOS DATAN DATAN2 DSINH DCOSH DTANH DSQRT DEXP DLOG DLOG10 DABS DMOD
DSIGN DDIM DMAX1 DMIN1 DINT DNINT DBLE DFLOAT DPROD IDINT IDNINT SIN COS TAN ASIN ACOS ATAN ATAN2 SQRT EXP LOG
LOG10 ABS IABS MOD SIGN ISIGN MAX MIN MAX0 MIN0 AMAX1 AMIN1 MAX1 MIN1 INT NINT IFIX FLOAT SNGL ICHAR CHAR
LEN""".split())
TYPES = r"DOUBLE\s*PRECISION|INTEGER|REAL|LOGICAL|CHARACTER(?:\s*\*\s*\d+)?"
RE_UNIT = re.compile(rf"^(?:({TYPES})\s+)?(SUBROUTINE|FUNCTION)\s+([A-Z]\w*)\s*(?:\((.*)\))?\s*$")
RE_BDATA = re.compile(r"^BLOCK\s*DATA\s*([A-Z]\w*)?\s*$")
RE_ENTRY = re.compile(r"^ENTRY\s+([A-Z]\w*)\s*(?:\((.*)\))?\s*$")
RE_DECL = re.compile(rf"^({TYPES})\s+(?!FUNCTION\b)(.*)$")
RE_IDENT = re.compile(r"(?<![\w.])[A-Z][A-Z0-9_]*\b")
RE_NUM = re.compile(r"(?<![A-Z0-9_])(?:\d+(?:\.(?![A-Z]{2,}\.)\d*)?|\.\d+)(?:[DE][+-]?\d+)?")
RE_DOTOP = re.compile(r"\.(?:EQ|NE|LT|LE|GT|GE|AND|OR|NOT|EQV|NEQV|TRUE|FALSE)\.")


def strip_strings(s):
    """Blank out '...' literals ('' inside is a quote)."""
    return re.sub(r"'(?:[^']|'')*'", "''", s)


def statements(lines):
    """Fixed form -> (comments, statements).  comments: [(line, text)]; statements: dicts with
    first/last line, label, raw text (columns 7-72 joined) and upper-case text without strings."""
    comments, stmts = [], []
    for n, line in enumerate(lines, 1):
        if not line.strip() or line[0] in "Cc*!":
            comments.append((n, line.rstrip()))
            continue
        line = line[:72].ljust(6)
        body = line[6:]
        if line[5] not in " 0" and stmts:
            stmts[-1]["last"] = n
            stmts[-1]["raw"] += body.strip()
            continue
        stmts.append({"first": n, "last": n, "label": line[:5].strip(), "raw": body.strip()})
    for s in stmts:
        s["up"] = strip_strings(s["raw"]).upper()
    return comments, stmts


def split_top(s):
    """Split on commas outside parentheses."""
    out, depth, cur = [], 0, ""
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            out.append(cur.strip())
            cur = ""
        else:
            cur += ch
    if cur.strip():
        out.append(cur.strip())
    return out


def entities(s):
    """'A, B(3,N), C' -> [(name, dims or None)]."""
    out = []
    for item in split_top(s):
        m = re.match(r"([A-Z]\w*)\s*(?:\((.*)\))?$", item)
        if m:
            out.append((m.group(1), [d.strip() for d in split_top(m.group(2))] if m.group(2) else None))
    return out


def commons(s):
    """'COMMON /A/ X, Y /B/ Z' -> [(block, [(name, dims)])]."""
    out = []
    for blk, body in re.findall(r"/\s*(\w*)\s*/([^/]*)", s):
        out.append((blk or "BLANK", entities(body.strip().rstrip(","))))
    return out


def idents(s):
    s = RE_NUM.sub(" ", s)
    s = RE_DOTOP.sub(" ", s)
    return RE_IDENT.findall(s)


def ptype(t):
    return re.sub(r"\s+", " ", re.sub(r"DOUBLE\s*PRECISION", "DOUBLE PRECISION", t))


def fences(lines, stmts, lo, hi):
    """RESTOMOD markers in lines lo..hi: [{from, to, why}].  The reason runs on over the comment
    lines below the marker up to a bare comment line, another marker or a statement.  A single
    RESTOMOD: covers the next statement."""
    out, open_ = [], None
    for n in range(lo, hi + 1):
        text = lines[n - 1]
        if text[:1] not in "Cc*":
            continue
        up = text.upper()
        i = up.find("RESTOMOD")
        if i < 0:
            continue
        if up[i:].startswith("RESTOMOD END"):
            if open_:
                open_["to"] = n
            open_ = None
            continue
        why = [text[i + 8:].strip()]
        k = n
        while k < len(lines) and lines[k][:1] in "Cc*" and comment_text(lines[k]).strip() \
                and "RESTOMOD" not in lines[k].upper():
            why.append(comment_text(lines[k]).strip())
            k += 1
        why = " ".join(why)
        if up[i:].startswith("RESTOMOD BEGIN"):
            open_ = {"from": n, "to": hi, "why": why[5:].lstrip(" :")}
            out.append(open_)
        else:
            nxt = next((s["last"] for s in stmts if s["first"] > n), n)
            out.append({"from": n, "to": nxt, "why": why.lstrip(" :"), "single": True})
    return out


def comment_text(text):
    return text[1:].rstrip()


def is_sep(text):
    return re.match(r"^[Cc*][=-]{8,}\s*$", text) is not None


def dedent(block):
    while block and not block[0].strip():
        block.pop(0)
    while block and not block[-1].strip():
        block.pop()
    ind = min((len(b) - len(b.lstrip()) for b in block if b.strip()), default=0)
    return "\n".join(b[ind:] for b in block)


def doc_above(lines, hdr):
    """Comment block above line hdr (1-based): back to a bare comment line, or, when it closes with a
    separator (C=== / C---), back to the opening separator."""
    i = hdr - 2
    block, boxed = [], False
    if i >= 0 and is_sep(lines[i]):
        boxed, i = True, i - 1
    while i >= 0 and lines[i][:1] in "Cc*":
        t = lines[i].rstrip()
        if is_sep(t):
            break
        if not comment_text(t).strip() and not boxed:
            break
        block.insert(0, comment_text(t))
        i -= 1
    return dedent(block)


def doc_top(lines):
    """The file's leading comment block, separators dropped."""
    block = []
    for t in lines:
        if t[:1] not in "Cc*":
            break
        if not is_sep(t):
            block.append(comment_text(t))
    return dedent(block)


def doc_below(comments, stmts, hdr_last):
    """Comment lines right after the header that are not RESTOMOD markers, up to the first statement
    that is not an INCLUDE."""
    nxt = next((s["first"] for s in stmts if s["first"] > hdr_last and not s["up"].startswith("INCLUDE")), 10 ** 9)
    block = [comment_text(t) for n, t in comments
             if hdr_last < n < nxt and "RESTOMOD" not in t.upper() and t.strip()[:1] in "Cc*"]
    return dedent(block)


def eval_param(expr, known):
    e = re.sub(r"(\d)[Dd]([+-]?\d)", r"\1e\2", expr)
    try:
        v = eval(e, {"__builtins__": {}}, dict(known))
    except Exception:
        return None
    return v if isinstance(v, (int, float)) else None


def parse_params(up, known, src):
    """PARAMETER (A=1, B=A*2) -> {name: {expr, value}}; updates known."""
    m = re.match(r"^PARAMETER\s*\((.*)\)\s*$", up)
    out = {}
    if not m:
        return out
    for item in split_top(m.group(1)):
        if "=" in item:
            k, v = (x.strip() for x in item.split("=", 1))
            val = eval_param(v, known)
            if val is not None:
                known[k] = val
            out[k] = {"expr": v, "value": val, "file": src}
    return out


def file_kinds():
    """File -> kind from the ELEMENTS list in the header of src/vdrive.f."""
    kinds = {}
    hdr = []
    for line in (SRC / "vdrive.f").read_text().splitlines():
        if line[:1] not in "Cc*":
            break
        hdr.append(line[1:])
    text = "\n".join(hdr)
    m = re.search(r"ELEMENTS\.(.*?)\n\s*\n", text.replace("\n \n", "\n\n"), re.S)
    sect, layer = None, None
    for line in (m.group(1) if m else "").splitlines():
        s = line.strip()
        if s.startswith("Core:"):
            sect = "Core"
        elif s.startswith("Layers"):
            sect = "Layer"
        elif s.startswith("Data:"):
            sect = "Data"
        for f, num in re.findall(r"(\w+\.(?:f|inc))(?:\s+(\d+))?", line):
            if f in kinds:
                continue
            if "this driver" in line and f == line.split()[0]:
                kinds[f] = "Driver"
            elif "dispatcher" in line and f == line.split()[0]:
                kinds[f] = "Dispatcher"
            elif sect == "Layer":
                layer = num or layer
                kinds[f] = f"Layer {layer}"
            elif sect:
                kinds[f] = sect
    return kinds


def parse_include(path, params, cblocks, decls):
    lines = path.read_text().splitlines()
    comments, stmts = statements(lines)
    known = {k: v["value"] for k, v in params.items() if v["value"] is not None}
    for s in stmts:
        up = s["up"]
        if up.startswith("PARAMETER"):
            for k, v in parse_params(up, known, path.name).items():
                v["line"] = s["first"]
                params[k] = v
        elif up.startswith("COMMON"):
            for blk, mem in commons(up[6:]):
                b = cblocks.setdefault(blk, {"members": [], "file": path.name, "line": s["first"],
                                             "referenced_by": [], "initialised_by": []})
                b["members"] += [n for n, _ in mem]
        else:
            m = RE_DECL.match(up)
            if m:
                for n, d in entities(m.group(2)):
                    decls[n] = {"type": ptype(m.group(1)), "dims": d}
    return {"path": f"src/{path.name}", "kind": "Include", "lines": len(lines),
            "restomod": fences(lines, stmts, 1, len(lines)), "doc": doc_top(lines), "units": []}


def parse_units(path, lines, comments, stmts):
    """Split a file's statements into program units."""
    units, cur = [], None
    for s in stmts:
        up = s["up"]
        m, b, e = RE_UNIT.match(up), RE_BDATA.match(up), RE_ENTRY.match(up)
        if cur is None and (m or b):
            if m:
                cur = {"name": m.group(3), "kind": m.group(2).lower(),
                       "type": ptype(m.group(1)) if m.group(1) else None,
                       "args": [a for a in (x.strip() for x in (m.group(4) or "").split(",")) if a]}
            else:
                cur = {"name": b.group(1) or "BLOCKDATA", "kind": "block data", "type": None, "args": []}
            cur.update({"file": f"src/{path.name}", "start": s["first"], "hdr_last": s["last"], "stmts": []})
            continue
        if cur is None:
            continue
        if e:
            units.append({"name": e.group(1), "kind": "entry", "type": cur["type"], "parent": cur["name"],
                          "args": [a for a in (x.strip() for x in (e.group(2) or "").split(",")) if a],
                          "file": cur["file"], "start": s["first"], "hdr_last": s["last"], "stmts": None})
        if re.match(r"^END\s*$", up):
            cur["end"] = s["last"]
            for u in units:
                if u.get("parent") == cur["name"] and "end" not in u:
                    u["end"] = s["last"]
            units.append(cur)
            cur = None
            continue
        cur["stmts"].append(s)
    return units


def analyse(u, lines, comments, stmts, cblocks, params, funcs):
    """Fill a unit's declarations, references and calls."""
    member = {n: blk for blk, b in cblocks.items() for n in b["members"]}
    decl, local_common, local_params, refs, calls, includes = {}, {}, {}, set(), [], []
    known = {k: v["value"] for k, v in params.items() if v["value"] is not None}
    for s in u["stmts"]:
        raw, up = s["raw"].upper(), s["up"]
        mi = re.match(r"^INCLUDE\s*'([^']*)'", raw)
        if mi:
            includes.append(mi.group(1))
            continue
        md = RE_DECL.match(up)
        if md:
            for n, d in entities(md.group(2)):
                decl[n] = {"type": ptype(md.group(1)), "dims": d}
                for x in d or []:
                    refs.update(idents(x))
            continue
        if up.startswith("DIMENSION"):
            for n, d in entities(up[9:]):
                decl.setdefault(n, {"type": None, "dims": None})["dims"] = d
            continue
        if up.startswith("COMMON"):
            for blk, mem in commons(up[6:]):
                for n, d in mem:
                    local_common[n] = blk
                    if d:
                        decl.setdefault(n, {"type": None, "dims": None})["dims"] = d
            continue
        if up.startswith("PARAMETER"):
            for k, v in parse_params(up, dict(known), u["file"]).items():
                local_params[k] = v
            continue
        if re.match(r"^(EXTERNAL|INTRINSIC|IMPLICIT|SAVE)\b", up):
            continue
        mc = re.match(r"^(?:IF\s*\(.*\)\s*)?CALL\s+([A-Z]\w*)", up)
        if mc:
            calls.append(mc.group(1))
        refs.update(idents(up))
    own = u["name"]
    arrays = {n for n, d in decl.items() if d["dims"]}
    fref = sorted(n for n in refs if n in funcs and n != own and n not in arrays)
    u["calls"] = sorted(set(calls) | set(fref))
    u["includes"] = includes
    names_inc = set()
    if includes:
        names_inc = set(member) | set(params)
    used = {}
    for n in sorted(refs):
        blk = local_common.get(n) or (member.get(n) if includes else None)
        if blk:
            used.setdefault(blk, []).append(n)
    u["common"] = used
    u["parameters"] = sorted(n for n in refs if (n in params and n in names_inc or n in local_params)
                             and n not in decl)
    if local_params:
        u["local_parameters"] = local_params
    u["intrinsics"] = sorted(n for n in refs if n in INTRINSICS and n not in decl)
    vars_ = []
    for n, d in decl.items():
        if n in funcs and not d["dims"]:
            continue
        v = {"name": n, "type": d["type"], "dims": d["dims"]}
        if n in u["args"]:
            v["arg"] = True
        if n in local_common:
            v["common"] = local_common[n]
        vars_.append(v)
    u["vars"] = vars_
    u["functions_declared"] = sorted(n for n, d in decl.items() if n in funcs and not d["dims"])
    u["restomod"] = fences(lines, stmts, u["start"], u["end"])
    u["doc"] = doc_above(lines, u["start"]) or doc_below(comments, stmts, u["hdr_last"])
    u["outline"] = outline(u["stmts"])
    return used


def close_paren(s, i):
    """Index of the ')' matching the '(' at s[i], or -1."""
    depth = 0
    for j in range(i, len(s)):
        if s[j] == "(":
            depth += 1
        elif s[j] == ")":
            depth -= 1
            if depth == 0:
                return j
    return -1


def outline(stmts):
    """A unit's statement outline, in line order: DO loops (k do: label, var, line, end), block IFs (k if: line,
    end, else: the ELSE IF / ELSE lines), GO TOs (k goto: to, the target labels; computed GO TO and arithmetic IF
    give several, with `on` the index expression), CALLs (k call: name), RETURN and STOP, and labelled statements
    (k label: label, stmt, the statement's first word).  `depth` is the DO/IF nesting; `cond` marks a statement
    under a logical IF; `t` is a short text for DO and IF.
    Limits: line-oriented like the rest of this file.  Labels are matched within the unit only; a DO ends at the
    statement carrying its label (shared terminals close every loop on them); assigned GO TO, ENTRY and
    alternate returns are not followed; a GO TO list continued onto further lines is read from the joined
    statement, so its `line` is the statement's first."""
    out, stack = [], []

    def short(t):
        t = re.sub(r"\s+", " ", t).strip()
        return t if len(t) <= 44 else t[:43] + "…"

    def simple(up, s, cond):
        d = len(stack)
        m = re.match(r"^GO\s*TO\s*\((.*?)\)\s*,?\s*(.*)$", up)
        if m:
            out.append({"k": "goto", "line": s["first"], "to": [x.strip() for x in m.group(1).split(",") if x.strip()],
                        "on": m.group(2).strip(), "depth": d, **({"cond": True} if cond else {})})
            return
        m = re.match(r"^GO\s*TO\s*(\d+)$", up)
        if m:
            out.append({"k": "goto", "line": s["first"], "to": [m.group(1)], "depth": d, **({"cond": True} if cond else {})})
            return
        m = re.match(r"^CALL\s+([A-Z]\w*)", up)
        if m:
            out.append({"k": "call", "line": s["first"], "name": m.group(1), "depth": d, **({"cond": True} if cond else {})})
            return
        if re.match(r"^(RETURN|STOP)\b", up):
            out.append({"k": up.split()[0].lower(), "line": s["first"], "depth": d, **({"cond": True} if cond else {})})

    for s in stmts:
        up = s["up"].strip()
        d = len(stack)
        if s["label"]:
            out.append({"k": "label", "line": s["first"], "label": s["label"],
                        "stmt": (re.match(r"[A-Z]+", up) or [""])[0], "depth": d})
        m_if = re.match(r"^IF\s*\(", up)
        if re.match(r"^ELSE\s*IF\s*\(", up) or re.match(r"^ELSE$", up):
            top = next((n for n in reversed(stack) if n["k"] == "if"), None)
            if top:
                top["else"].append(s["first"])
        elif re.match(r"^END\s*IF$", up):
            while stack and stack[-1]["k"] != "if":
                stack.pop()
            if stack:
                stack.pop()["end"] = s["last"]
        elif re.match(r"^END\s*DO$", up):
            if stack and stack[-1]["k"] == "do":
                stack.pop()["end"] = s["last"]
        elif m_if:
            j = close_paren(up, up.index("("))
            rest = up[j + 1:].strip() if j > 0 else ""
            if rest == "THEN":
                n = {"k": "if", "line": s["first"], "end": s["last"], "else": [], "t": short(up[:j + 1]), "depth": d}
                out.append(n)
                stack.append(n)
            elif re.match(r"^\d+\s*,\s*\d+\s*,\s*\d+$", rest):
                out.append({"k": "goto", "line": s["first"], "to": [x.strip() for x in rest.split(",")],
                            "on": up[up.index("(") + 1:j].strip(), "arith": True, "depth": d})
            else:
                simple(rest, s, True)
        else:
            m = re.match(r"^DO\s*(\d+)\s*,?\s*([A-Z]\w*)\s*=(.*,.*)$", up) or re.match(r"^DO\s+()([A-Z]\w*)\s*=(.*,.*)$", up)
            if m:
                n = {"k": "do", "line": s["first"], "end": s["last"], "label": m.group(1), "var": m.group(2),
                     "t": short(f"{m.group(2)} = {m.group(3)}"), "depth": d}
                out.append(n)
                stack.append(n)
            else:
                simple(up, s, False)
        if s["label"]:
            while stack and stack[-1]["k"] == "do" and stack[-1]["label"] == s["label"]:
                stack.pop()["end"] = s["last"]
    for n in out:
        if n["k"] == "if" and not n["else"]:
            del n["else"]
    return out


def main():
    params, cblocks, incdecl = {}, {}, {}
    files = [parse_include(SRC / n, params, cblocks, incdecl) for n in ("viewdims.inc", "viewcom.inc", "viewsit.inc",
                                                                         "vdvoc.inc", "vdeck.inc")]
    for b in cblocks.values():
        b["types"] = {n: incdecl.get(n) for n in b["members"]}
    kinds = file_kinds()
    srcs = sorted(SRC.glob("*.f"), key=lambda f: (f.name not in ("vdrive.f", "view.f"), f.name))
    parsed, units = [], []
    for f in srcs:
        lines = f.read_text().splitlines()
        comments, stmts = statements(lines)
        us = parse_units(f, lines, comments, stmts)
        rec = {"path": f"src/{f.name}", "kind": "Data" if f.name == "viewdata.f" else kinds.get(f.name, "Core"),
               "lines": len(lines), "doc": doc_top(lines), "units": [u["name"] for u in us]}
        files.append(rec)
        parsed.append((f, lines, comments, stmts, us, rec))
        units += us
    funcs = {u["name"] for u in units if u["kind"] == "function" or (u["kind"] == "entry" and u["type"])}
    for f, lines, comments, stmts, us, rec in parsed:
        if f.name == "viewdata.f":
            for u in us:
                blks = sorted({blk for s in u["stmts"] if s["up"].startswith("COMMON")
                               for blk, _ in commons(s["up"][6:])})
                u["initialises"] = blks
                for blk in blks:
                    if blk in cblocks:
                        cblocks[blk]["initialised_by"].append(u["name"])
                u["doc"] = doc_above(lines, u["start"])
                u["restomod"] = fences(lines, stmts, u["start"], u["end"])
            continue
        for u in us:
            if u["kind"] == "entry":
                continue
            for blk in analyse(u, lines, comments, stmts, cblocks, params, funcs):
                if blk in cblocks:
                    cblocks[blk]["referenced_by"].append(u["name"])
    byname = {u["name"]: u for u in units}
    for u in units:
        u.setdefault("calls", [])
        u["called_by"] = []
        for k in ("stmts", "hdr_last"):
            u.pop(k, None)
    for u in units:
        u["unresolved"] = [c for c in u["calls"] if c not in byname]
        for c in u["calls"]:
            if c in byname and u["name"] not in byname[c]["called_by"]:
                byname[c]["called_by"].append(u["name"])
    for u in units:
        u["called_by"].sort()
        if not u["unresolved"]:
            del u["unresolved"]
    out = {"files": files, "units": units, "common": cblocks, "parameters": params}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"gen_symbols: {OUT.relative_to(R) if OUT.is_relative_to(R) else OUT}: {len(files)} files, "
          f"{len(units)} units, {len(cblocks)} COMMON blocks, {len(params)} PARAMETERs")


main()
