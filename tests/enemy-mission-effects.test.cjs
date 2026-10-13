"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../hunt-engine"), Feedback = require("../hunt-mission-feedback");
const Effects = require("../hunt-enemy-mission-effects"), publicText = require("../hunt-public-text");
const data = require("../campaigns/long-hunt/data.json"), options = { E, publicText, data }, targets = new Map();
for (const file of ["full-campaign-actual-v10-commands.json", "v074-shelter-natural-commands.json",
  "v074-patient-natural-commands.json", "v074-ch2-bridge-natural-commands.json"]) {
  let state = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14 });
  for (const command of require("./fixtures/" + file)) {
    const usingReaction = () => command.type === "USE_REWARD" && E.killReactionActions(state).some(action =>
      !action.disabled && action.command.type === "USE_REWARD" && action.command.rewardId === command.rewardId &&
      action.command.enemyId === command.enemyId);
    while (state.phase === "kill_react" && !state.rewardChoices.length && !usingReaction()) state = E.dispatch(state, { type: "PASS_KILL_REACTION" });
    const before = state; state = E.dispatch(state, command);
    for (const change of Effects.describe(state, E)) if (!targets.has(change.card)) targets.set(change.card, { before, state, change });
  }
}

test("all four naturally disclosed mission replacements describe the resolved attacks and their conditions", () => {
  assert.deepEqual([...targets.keys()].sort((a,b) => a-b), [3,10,31,36]);
  const expected = { 3: /광포한.*방해.*기절.*방해 불가/, 10: /피의 광란.*속도 3.*피해 2/,
    31: /갈가리 찢기.*속도 3.*피해 3.*기절/, 36: /고통 면역.*속도 1.*피해 4.*방해 불가.*방어 2/ };
  for (const [number, { state, change }] of targets) {
    assert.match(change.effects.join(" "), expected[number]);
    assert.doesNotMatch([change.title, change.description, ...change.effects].join(" "), /\d+번|[AB]면|앞면|뒷면/);
    const saved = E.exportSave(state); assert.deepEqual(Effects.describe(state, E).find(x => x.card === number), change);
    assert.equal(E.exportSave(state), saved, "description cannot mutate gameplay or saved command history");
  }
  assert.match(targets.get(10).change.effects.join(" "), /가득.*피해 2.*피해를 입은.*피해 4/);
  assert.match(targets.get(31).change.effects.join(" "), /타일의 속도 감소를 받지/);
});

test("a newly active enemy replacement is included once in its mission notice without a duplicate objective", () => {
  for (const { before, state, change } of targets.values()) {
    const events = Feedback.describe(before, state, options), text = events.map(e => [e.description, ...(e.effects || [])].join(" ")).join(" ");
    assert.match(text, new RegExp(change.effects[0].split(" · ")[0]));
    assert.equal(events.filter(e => e.objectiveId === change.objectiveId).length, 1);
    assert.deepEqual(Feedback.describe(state, state, options), []);
  }
});

test("undisclosed, completed, removed and non-target enemies never expose mission replacement information", () => {
  // Deliberately isolated presentation guard cases, never imported for browser play.
  const source = targets.get(3).state;
  for (const edit of [s => { s.mission.revealed = s.mission.revealed.filter(n => n !== 3); },
    s => { s.mission.targets.main.complete = true; }, s => { s.enemies = []; },
    s => { s.mission.targets.main.enemyId = "unrelated"; }]) {
    const state = structuredClone(source); edit(state);
    assert.deepEqual(Effects.describe(state, E), []);
  }
  assert.deepEqual(Effects.describe(E.create(), E), []);
});

test("the wounded blood-frenzy condition changes the public summary without repeating it on render", () => {
  // Current HP branch contract; gameplay-natural activation is checked above.
  const before = targets.get(10).state, after = structuredClone(before);
  const enemy = after.enemies.find(e => e.id === targets.get(10).change.enemyId); enemy.hp--;
  const change = Effects.describe(after, E).find(x => x.card === 10);
  assert.match(change.effects[0], /피해 4/);
  const events = Feedback.describe(before, after, options);
  assert.equal(events.length, 1); assert.equal(events[0].objectiveId, "shelter");
  assert.match(events[0].effects.join(" "), /피의 광란.*피해 4/);
  assert.deepEqual(Feedback.describe(after, after, options), []);
});
