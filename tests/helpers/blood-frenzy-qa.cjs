"use strict";
const E = require("../../hunt-engine");
const shelterCommands = require("../fixtures/v074-shelter-natural-commands.json");

// SYNTHETIC-QA: these inputs replay an existing route through the public API
// in verification mode. They are not newly earned normal-play evidence.
const variants = Object.freeze(["fast", "tie", "mist", "interrupt", "token"]);
const ADVANCE_TO_UNBUFFED_SPECIAL = Object.freeze([
  { type: "END_TURN" }, { type: "NO_ATTACK" },
  { type: "DODGE", cardId: "card-3", slot: 0 },
  { type: "RESOLVE" }, { type: "REFILL" },
].map(Object.freeze));
const APPLY_RULING = Object.freeze({ type: "APPLY_TILE_SPEED_RULING" });
const RESOLVE = Object.freeze({ type: "RESOLVE" });
const baseAttack = { type: "ATTACK", cardId: "card-12", slot: 0, enemyId: "scourge-beast-1" };
const ATTACKS = Object.freeze({
  fast: Object.freeze({ ...baseAttack }),
  tie: Object.freeze({ ...baseAttack, slot: 1 }),
  mist: Object.freeze({ ...baseAttack, itemIds: Object.freeze(["item-numbing-mist-1"]) }),
  interrupt: Object.freeze({ ...baseAttack, rewardIds: Object.freeze(["reward-13"]) }),
  token: Object.freeze({ ...baseAttack }),
});
function checkVariant(variant) {
  if (!variants.includes(variant)) throw Error(`Unknown blood-frenzy QA variant: ${variant}`);
}
function setup(variant = "fast") {
  checkVariant(variant);
  return { seed: 90, weaponId: "burial", face: 1, firearmId: "hunter-pistol", startSpace: "center",
    options: { campaign: true, rulesVersion: 14,
      qa: { preset: "custom", startRewards: variant === "interrupt" ? ["rune-writhe"] : [],
        startConsumables: variant === "mist" ? ["numbing-mist"] : [] } } };
}
function strictRoundTrip(state) {
  const save = E.exportSave(state), replayed = E.importSave(save);
  if (E.exportSave(replayed) !== save) throw Error("SYNTHETIC-QA blood-frenzy checkpoint replay mismatch");
  return replayed;
}
function checkpoint(variant = "fast") {
  const spec = setup(variant);
  let s = E.create(spec.seed, spec.weaponId, spec.face, null, spec.firearmId, spec.startSpace, spec.options);
  for (let index = 0; index < 99; index++) {
    let command = { ...shelterCommands[index] };
    // One starting reward advances the UID for the later purchased upgrade.
    if (variant === "interrupt" && command.cardId === "card-14") command.cardId = "card-15";
    // Leave this target on HP1 with its extra-life token, rather than spending it.
    if (variant === "token" && index === 95) command.slot = 0;
    const usesKillReward = () => command.type === "USE_REWARD" && E.killReactionActions(s).some(action =>
      !action.disabled && action.command.rewardId === command.rewardId && action.command.enemyId === command.enemyId);
    while (s.phase === "kill_react" && !s.rewardChoices.length && !usesKillReward())
      s = E.dispatch(s, { type: "PASS_KILL_REACTION" });
    s = E.dispatch(s, command);
  }
  s = E.dispatch(s, APPLY_RULING);
  // This public no-attack/dodge turn consumes the ability-enhanced attack. The
  // next special is unbuffed; no enemy-deck or runtime-state edits are needed.
  if (variant !== "token") for (const command of ADVANCE_TO_UNBUFFED_SPECIAL) s = E.dispatch(s, command);
  return strictRoundTrip(s);
}
function attackCommand(variant = "fast") {
  checkVariant(variant);
  return JSON.parse(JSON.stringify(ATTACKS[variant]));
}
function recipe(variant = "fast") {
  const state = checkpoint(variant);
  return { scope: "SYNTHETIC-QA", setup: setup(variant),
    commands: state.commands.map(command => JSON.parse(JSON.stringify(command))) };
}
module.exports = { checkpoint, setup, recipe, attackCommand, strictRoundTrip, variants,
  ATTACKS, APPLY_RULING, ADVANCE_TO_UNBUFFED_SPECIAL, RESOLVE };
