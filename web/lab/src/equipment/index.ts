// The equipment library: each module in this directory exports build(ctx): Equipment; the room places them by
// these names.
import type { EquipmentBuilder } from "../types";
import { build as desk } from "./desk";
import { build as vectorTerminal } from "./vector-terminal";
import { build as glassTerminal } from "./glass-terminal";

export const EQUIPMENT: Record<string, EquipmentBuilder> = {
  "desk": desk,
  "vector-terminal": vectorTerminal,
  "glass-terminal": glassTerminal,
};
