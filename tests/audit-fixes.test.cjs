const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../hunt-engine"), R = require("../rewards-engine");
const commands = require("./fixtures/chapter-one-commands.json");
const H = E.hunter;
function checkpoint(n) {
  let s = E.create(90,"burial",1,null,"hunter-pistol","center",{campaign:true});
  for (const a of commands.slice(0,n)) s = E.dispatch(s,a);
  return s;
}
test("central lamp offers every fog space, accepts a non-lamp destination and exactly replays the movement", () => {
  for (const space of ["left","center","right"]) {
    const s = checkpoint(17); assert.equal(H(s).position,"tile-14:center");
    const destination = `tile-04:${space}`;
    assert(E.centralLampDestinations(s).some((n) => n.id === destination));
    const moved = E.dispatch(s,{type:"INTERACT",cardId:H(s).hand[0].id,lamp:destination});
    assert.equal(H(moved).position,destination);
    assert.equal(H(moved).hand.length,H(s).hand.length-1);
    assert.deepEqual(E.importSave(E.exportSave(moved)),moved);
  }
});
test("central lamp rejects ordinary destinations and the lantern cannot target a destroyed lamp", () => {
  const s = checkpoint(17), before = structuredClone(s);
  assert.throws(() => E.dispatch(s,{type:"INTERACT",cardId:H(s).hand[0].id,lamp:"tile-14:left"}),/등불.*안개/);
  assert.deepEqual(s,before);
  const rewardId = R.grant(s,"lantern");
  assert.throws(() => E.dispatch(s,{type:"USE_REWARD",rewardId,node:"tile-04:center"}),/등불.*안개/);
  assert.equal(H(s).rewards[0].ready,true);
});
test("one stat action can combine rescue and both consumable tokens in the same space", () => {
  const s = checkpoint(71), beforeHand = H(s).hand.length;
  assert(E.interactionOptions(s).missionRescue); assert.equal(E.interactionOptions(s).loot,2);
  let combined = E.dispatch(s,{type:"INTERACT",cardId:H(s).hand[0].id,mission:"rescue",lootCount:2});
  // The enemies in this space react first; the interaction survives those choices.
  while (combined.interaction && ["combat_react","stun","combat_extra"].includes(combined.phase)) {
    const a = combined.phase === "stun" ? {type:"STUN_DISCARD",cardId:H(combined).hand[0]?.id} :
      combined.phase === "combat_extra" ? {type:"EXTRA_TAKE"} :
      E.canFirearm(combined) ? {type:"FIREARM"} : {type:"RESOLVE"};
    combined = E.dispatch(combined,a);
  }
  assert.equal(combined.phase,"mission_survivor");
  assert.equal(H(combined).consumables.length,2);
  assert.equal(E.interactionOptions(combined).loot,0);
  assert(H(combined).hand.length <= beforeHand-1);
  assert.deepEqual(E.importSave(E.exportSave(combined)),combined);
});
