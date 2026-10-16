"use strict";
const E = require("../../src/hunt-engine");
// Canonical verification-mode saves, built only with public commands. These
// checkpoints are reproducible QA inputs, not personal normal-play evidence.
function checkpoint(face = 1, weapon = "burial") {
  const firearm = weapon === "burial" ? "hunter-pistol" : require("../../src/extended-weapons").definition(weapon).defaultFirearm;
  let s = E.create(3, weapon, face, null, firearm, "center", { campaign: true, rulesVersion: 14,
    qa: { preset: "custom", startRewards: [], startConsumables: ["qa-travel"] } });
  const commands = [{ type: "USE_CONSUMABLE", itemId: "item-qa-1-1" },
    { type: "EXPLORE", edge: "N" }, { type: "PLACE_TILE", rotation: 0 },
    { type: "STEP", node: "tile-14:center" }, { type: "EXPLORE", edge: "S" }, { type: "PLACE_TILE", rotation: 0 },
    { type: "STEP", node: "tile-17:lower-left" }, { type: "EXPLORE", edge: "W" }, { type: "PLACE_TILE", rotation: 0 },
    { type: "EXPLORE", edge: "N" }, { type: "PLACE_TILE", rotation: 0 }];
  for (const command of commands) s = E.dispatch(s, command);
  s = E.dispatch(s, { type: "MOVE", cardId: E.hunter(s).hand[0].id });
  for (const node of ["tile-11:street", "tile-17:lower-left"]) s = E.dispatch(s, { type: "STEP", node });
  if (!face || weapon !== "burial") {
    s = E.dispatch(s, { type: "MOVE", cardId: E.hunter(s).hand[0].id });
    s = E.dispatch(s, { type: "STEP", node: "tile-11:street" });
    s = E.dispatch(s, { type: "STOP_MOVE" });
  }
  const save = E.exportSave(s);
  if (E.exportSave(E.importSave(save)) !== save) throw Error("QA checkpoint replay mismatch");
  return s;
}
module.exports = { checkpoint };
