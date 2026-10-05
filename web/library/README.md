# The reference library

The manuals and reports this reconstruction is built from, published with the page at `library/` and shown by its
Library (`web/src/library.js`; see `docs/modes.md`). `library.json` is the manifest the page and the machine room's
bookcase read (`tools/assemble.py` inlines it; `web/lab/src/equipment/bookcase.ts` imports it).

The two NASA reports in `reference/` are not copied: `MSC-IN-69-FM-197_Apollo11_views.pdf` and
`TN-D-6853_Hyle_Lunde_1972.pdf` here are symbolic links to them, so `make serve` (which serves `web/`) finds them and
`.github/workflows/pages.yml` copies the files behind them (`cp -rL`).

## Rights

The Sperry Rand manuals (UP-, UE-) are © Sperry Rand Corporation, whose computer business is now Unisys: Sperry and
Burroughs merged to form Unisys in 1986 (<https://en.wikipedia.org/wiki/Unisys>). The Stromberg-Carlson documents are
© Stromberg-Carlson, then a General Dynamics company; its data products division became Stromberg Datagraphix, Inc.
(1968 to 1976, <https://en.wikipedia.org/wiki/Stromberg-Carlson>), later acquired by Anacomp according to the same
article's links; we have not established who holds these rights today. These copies are hosted as historical
reference, as fourmilab.ch and bitsavers.org host them, and will be removed at the rights holder's request: open an
issue at <https://github.com/aaronsb/view1108/issues>.

The NASA reports are US Government works, in the public domain. HEPCAT was written by TRW Systems for NASA MSC under
contract and is distributed by NASA's Technical Reports Server.

## Files

| File | Document | Publisher, date | Source |
|---|---|---|---|
| `UP-4046_1108mpSysDescr.pdf` | UNIVAC 1108 Multi-Processor System, System Description | Sperry Rand (UNIVAC), © 1966-1970 | <https://fourmilab.ch/documents/univac/manuals/pdf/1108/UP-4046_1108mpSysDescr.pdf> |
| `UE-637_1108execUG_1970.pdf` | UNIVAC 1108 Executive Users Guide, R. W. Moore | Sperry Rand (UNIVAC Marketing Education), © 1970 | <https://fourmilab.ch/documents/univac/manuals/pdf/1108/UE-637_1108execUG_1970.pdf> |
| `UP-7604_1108_Display_Console_Component_Description_1968.pdf` | UNIVAC 1108 Display Console, Component Description | Sperry Rand (UNIVAC), © 1968 | <https://fourmilab.ch/documents/univac/manuals/pdf/1108/UP-7604_1108_Display_Console_Component_Description_1968.pdf> |
| `UP-7789_Advanced_Graphic_System_Type_1557_1558_General_Description_1970.pdf` | UNIVAC Advanced Graphic System Type 1557/1558, General Description | Sperry Rand (UNIVAC), 1970 | <https://fourmilab.ch/documents/univac/manuals/pdf/Peripherals/UP-7789_Advanced_Graphic_System_Type_1557_1558_General_Description_1970.pdf> |
| `UP-7701r2_Uniscope_100_Display_Terminal_General_Description_1973.pdf` | UNISCOPE 100 Display Terminal, General Description, rev. 2 | Sperry Rand (UNIVAC), 1973 | <https://fourmilab.ch/documents/univac/manuals/pdf/Uniscope/UP-7701r2_Uniscope_100_Display_Terminal_General_Description_1973.pdf> |
| `S-C_4020_Computer_Recorder_Information_Manual_Aug1964.pdf` | S-C 4020 Computer Recorder Information Manual | Stromberg-Carlson, Aug 1964 | <https://bitsavers.org/pdf/strombergDatagraphix/SC_4020/S-C_4020_Computer_Recorder_Information_Manual_Aug1964.pdf> |
| `S-C_4020_Computer_Recorder_Brochure_Apr1965.pdf` | S-C 4020 Computer Recorder (brochure) | Stromberg-Carlson, Apr 1965 | <https://bitsavers.org/pdf/strombergDatagraphix/brochures/S-C_4020_Computer_Recorder_Brochure_Apr1965.pdf> |
| `MSC-IN-66-FM-79_Pruett_1966.pdf` | MSC Internal Note 66-FM-79, A Parametric Study of Central Angle of Travel and Time for Reentry from Near-Earth Orbits, W. R. Pruett | NASA MSC, 12 Aug 1966 | NTRS 19700025047, <https://ntrs.nasa.gov/citations/19700025047> |
| `MSC-IN-69-FM-197_Apollo11_views.pdf` (link) | MSC Internal Note 69-FM-197, Rev. 1, Views from the CM and LM During the Flight of Apollo 11 (Mission G), A. N. Lunde | NASA MSC, 3 Jul 1969 | NTRS 19740073250, <https://ntrs.nasa.gov/citations/19740073250> |
| `HEPCAT_Users_Manual_TRW_1970.pdf` | Users Manual for Computer Program HEPCAT | TRW Systems Group for NASA MSC, Jun 1970 | NTRS 19700027062, <https://ntrs.nasa.gov/citations/19700027062> |
| `TN-D-6853_Hyle_Lunde_1972.pdf` (link) | NASA TN D-6853, Apollo Experience Report: The Application of a Computerized Visualization Capability to Lunar Missions, C. T. Hyle and A. N. Lunde | NASA, 1972 | NTRS 19720017950, <https://ntrs.nasa.gov/citations/19720017950> |

Each file is byte-identical to its source (sizes checked against the source servers on 2026-10-04). In all 58.2 MB
are published, 49.3 MB of it stored here (the two links' 8.9 MB are in `reference/`).
