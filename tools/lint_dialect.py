#!/usr/bin/env python3
"""Check that the kernel stays in the period dialect described in CLAUDE.md.

Flags modern constructs and identifiers longer than 6 characters in fixed-form source,
unless the statement is preceded by a `C     RESTOMOD: <why>` comment or sits inside a
`C     RESTOMOD BEGIN: <why>` ... `C     RESTOMOD END` fence. Also checks fixed-form
layout (columns 1-72), which fences do not exempt.
Usage: lint_dialect.py src/vdrive.f [more.f ...]  (make lint passes every element)
"""
import re, sys

MODERN = [
    (r"^\s*END\s*DO\b", "END DO (use DO nn ... nn CONTINUE)"),
    (r"^\s*DO\s+(WHILE\b|[A-Z]\w*\s*=)", "DO without a statement label"),
    (r"^\s*(MODULE|USE|CONTAINS|INTERFACE)\b", "module/interface feature"),
    (r"\b(ALLOCATABLE|ALLOCATE|DEALLOCATE|POINTER|TARGET)\b", "dynamic memory"),
    (r"^\s*TYPE\b|\bTYPE\s*\(", "derived type"),
    (r"\bRECURSIVE\b", "recursion"),
    (r"\bIMPLICIT\s+NONE\b", "IMPLICIT NONE (not in FORTRAN V)"),
    (r"\bREAL\s*\(\s*8\s*\)|\bINTEGER\s*\(\s*\d\s*\)", "kind parameter (use DOUBLE PRECISION / INTEGER)"),
    (r"\bSELECT\s+CASE\b|\bCASE\s*\(", "SELECT CASE"),
    (r"\bINTENT\s*\(|\bBIND\s*\(", "F90 attribute"),
    (r"::", "F90 declaration syntax"),
    (r"!", "inline ! comment"),
]
KEYWORDS = {"SUBROUTINE", "FUNCTION", "CONTINUE", "INTEGER", "INCLUDE", "DOUBLE", "PRECISION",
            "PARAMETER", "LOGICAL", "EXTERNAL", "INTRINSIC", "IMPLICIT", "DIMENSION",
            "EQUIVALENCE", "COMMON", "RETURN", "CHARACTER"}


def _param_noninteger(text):
    """True if any NAME=VALUE in a PARAMETER list is not a plain integer literal."""
    for item in text.split(","):
        if "=" not in item:
            continue
        val = item.split("=", 1)[1].strip()
        if not re.fullmatch(r"[+-]?\d+", val):
            return True
    return False


def main(paths):
    bad = 0
    for path in paths:
        # "C     RESTOMOD: why" covers the next statement; "C     RESTOMOD BEGIN: why" ...
        # "C     RESTOMOD END" covers a block.
        pending = allow = False
        fence = 0
        for n, line in enumerate(open(path), 1):
            line = line.rstrip("\n")
            if not line.strip():
                continue
            if line[0] in "Cc*":
                up = line.upper()
                if "RESTOMOD BEGIN" in up:
                    fence = n
                elif "RESTOMOD END" in up:
                    fence = 0
                else:
                    pending = pending or "RESTOMOD:" in up
                continue
            if not (len(line) > 5 and line[5] not in " 0"):   # new statement, not a continuation
                allow, pending = pending, False
            allow = allow or fence > 0
            if len(line) > 72:
                print(f"{path}:{n}: longer than 72 columns")
                bad += 1
            if "\t" in line[:6]:
                print(f"{path}:{n}: tab in label/continuation field")
                bad += 1
            body = line[6:].upper()
            body = re.sub(r"'[^']*'", "''", body)      # ignore string contents
            for word in re.findall(r"\b[A-Z][A-Z0-9]*\b", body):
                if len(word) > 6 and word not in KEYWORDS and not allow:
                    print(f"{path}:{n}: identifier longer than 6 characters (FORTRAN V): {word}")
                    bad += 1
            m = re.match(r"^\s*PARAMETER\b\s*\(?(.*?)\)?\s*$", body)
            if m and not allow and _param_noninteger(m.group(1)):
                print(f"{path}:{n}: non-integer PARAMETER (FORTRAN V PARAMETER was integer-only, "
                      f"UP-4046 sec. 10.4.1): {line.strip()}")
                bad += 1
            for pat, what in MODERN:
                if re.search(pat, body) and not allow:
                    print(f"{path}:{n}: {what}: {line.strip()}")
                    bad += 1
        if fence:
            print(f"{path}:{fence}: RESTOMOD BEGIN without RESTOMOD END")
            bad += 1
    if bad:
        print(f"{bad} dialect issue(s)")
        sys.exit(1)
    print(f"dialect ok: {', '.join(paths)}")


if __name__ == "__main__":
    main(sys.argv[1:] or sorted(str(p) for p in __import__("pathlib").Path("src").glob("*.f") if p.name != "viewdata.f"))
