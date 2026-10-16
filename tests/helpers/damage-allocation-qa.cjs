"use strict";
const E = require("../../hunt-engine");

// SYNTHETIC-QA: supported create + public commands only, no state edits.
const commands = [
  { type: "MOVE", cardId: "card-1" },
  { type: "EXPLORE", edge: "N" },
  { type: "PLACE_TILE", rotation: 0 },
  { type: "STEP", node: "tile-03:room" },
  { type: "ATTACK", enemyId: "huntsmans-minion-1", cardId: "card-11", slot: 0 },
  { type: "FIREARM" },
  { type: "RESOLVE" },
  { type: "ATTACK", enemyId: "huntsmans-minion-1", cardId: "card-8", slot: 1 },
  { type: "RESOLVE" },
  { type: "TRANSFORM", cardId: "card-2" },
  { type: "WEAPON_CHOICE", enemyId: "huntsman-mob-1" },
  { type: "WEAPON_CHOICE", enemyId: "huntsmans-minion-1" },
];
function checkpoint(count = 9, firePaper = false) {
  let state = E.create(6, "uncanny-ludwigs-holy-blade", 0, null, "repeating-pistol", "center", {
    campaign: true, rulesVersion: 14,
    qa: { preset: "custom", startRewards: [], startConsumables: firePaper ? ["fire-paper"] : [] },
  });
  for (const [index, command] of commands.slice(0, count).entries())
    state = E.dispatch(state, firePaper && index === 7 ? { ...command, itemIds: ["item-fire-paper-1"] } : command);
  return E.importSave(E.exportSave(state));
}
module.exports = { checkpoint, commands };
