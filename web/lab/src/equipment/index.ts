// The equipment library: each module in this directory exports build(ctx, options?): Equipment; the room places them
// by these names. FOOTPRINT is each one's size, W x H x D in metres: its origin is on the floor (for "glass", the
// desk top) under the footprint's centre, its front toward +Z. docs/lab.md gives the sources.
import type { BuildContext, Equipment } from "../types";
import { build as vector } from "./vector-terminal";
import { build as glass } from "./glass-terminal";
import { build as uniservo } from "./uniservo";
import { build as cpu } from "./cpu";
import { build as console4009 } from "./console4009";
import { build as controller1557 } from "./controller1557";
import { build as printer } from "./printer";
import { build as cardreader } from "./cardreader";
import { build as reeltable } from "./reeltable";
import { build as desk } from "./desk";
import { build as chair } from "./chair";
import { build as filmrecorder } from "./filmrecorder";

/** Options a room may pass: a tape unit's numbers (head plate `number`, top strip `index`), a CPU cabinet's lamp panel. */
export interface EquipmentOptions { number?: number; index?: number; lampPanel?: boolean }
export type EquipmentFactory = (ctx: BuildContext, opts?: EquipmentOptions) => Equipment;

export const EQUIPMENT: Record<string, EquipmentFactory> = {
  vector, glass, uniservo, cpu, console4009, controller1557, printer, cardreader, reeltable, desk, chair, filmrecorder,
  // phase A's names, until the room uses the ones above
  "vector-terminal": vector, "glass-terminal": glass,
};

export const FOOTPRINT: Record<string, [number, number, number]> = {
  vector: [0.9, 1.5, 1.25],
  glass: [0.46, 0.33, 0.69],
  uniservo: [0.75, 1.8, 0.75],
  cpu: [0.8, 1.9, 0.8],
  console4009: [2.8, 1.25, 0.95],
  controller1557: [1.2, 1.6, 0.6],
  printer: [1.4, 1.2, 0.8],
  cardreader: [1.0, 1.1, 0.7],
  reeltable: [1.6, 0.75, 0.8],
  desk: [1.5, 0.73, 0.75],
  chair: [0.6, 0.88, 0.6],
  filmrecorder: [2.24, 1.88, 0.94],
};
