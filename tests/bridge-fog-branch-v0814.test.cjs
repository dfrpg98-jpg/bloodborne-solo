"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), Map = require("../src/hunt-map-controls"), C = require("../campaigns/long-hunt/data.json");
const clinic = require("./fixtures/v075-clinic52-completed-natural-commands.json"),
  chapel = require("./fixtures/v075-chapel-timing-natural-escort-first-commands.json");
function prefix(commands, count) {
  let state = E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 12 });
  for (const command of commands.slice(0, count)) state = E.dispatch(state, command);
  assert.deepEqual(E.importSave(E.exportSave(state)), state);
  return state;
}

test("the canonical retained-warning route opens 53→54 without bridge fog and retains the ordinary enemy on the tile", () => {
  const before = prefix(clinic, 318), normal = before.enemies.find(enemy => enemy.node === "tile-18:top" && !enemy.missionId),
    saved = E.exportSave(before), after = E.dispatch(before, clinic[318]);
  assert(normal, "the normally spawned mob already occupies the bridge before the movement-end mission trigger");
  assert(before.mission.history[1].completed.includes(39));
  assert(!before.mission.revealed.includes(53));
  assert(after.mission.revealed.includes(53)); assert(after.mission.revealed.includes(54));
  assert(!after.mission.revealed.includes(35)); assert.equal(after.mission.counters[54], 3);
  assert(!after.mission.fog.includes("tile-18")); assert.deepEqual(after.mission.fog, ["tile-19"]);
  assert.equal(Map.tileInfo(after, "tile-18").fog, false);
  assert.deepEqual(after.enemies.find(enemy => enemy.id === normal.id), normal,
    "card 54 does not create fog or remove a normal enemy that has entered the bridge");
  assert(C.cards.find(card => card.number === 53).rules.some(rule => rule.includes("54번")));
  assert(C.cards.find(card => card.number === 54).rules.every(rule => !rule.includes("안개")));
  assert.equal(E.exportSave(before), saved); assert.deepEqual(E.importSave(E.exportSave(after)), after);
});

test("the canonical card-35 bridge encounter removes normal pursuers that entered before fog while retaining outside enemies", () => {
  const before = prefix(chapel, 171), saved = E.exportSave(before), after = E.dispatch(before, chapel[171]),
    removed = ["scourge-beast-1", "scourge-beast-2", "huntsman-mob-2"],
    outside = ["huntsman-mob-1", "huntsmans-minion-1"], events = after.events.slice(-14).map(event => event.text);
  assert(before.move.chasers.some(chaser => chaser.enemyId === "scourge-beast-1"));
  assert(before.move.chasers.some(chaser => chaser.enemyId === "scourge-beast-2"));
  for (const id of removed) { assert(before.enemies.some(enemy => enemy.id === id)); assert(!after.enemies.some(enemy => enemy.id === id)); }
  for (const id of outside) assert.deepEqual(after.enemies.find(enemy => enemy.id === id), before.enemies.find(enemy => enemy.id === id));
  const pursuit = events.findIndex(text => text === "재앙의 야수 → 대교 / 아래 칸."),
    fog = events.findIndex(text => text === "대교 · 안개 진입로, 등불 파괴, 일반 적 제거.");
  assert(pursuit >= 0 && fog > pursuit, "the pursuer entered before the movement-end fog appeared and was then removed");
  assert(after.mission.revealed.includes(35)); assert(after.mission.revealed.includes(36));
  assert(after.mission.fog.includes("tile-18")); assert.equal(Map.tileInfo(after, "tile-18").fog, true);
  assert.deepEqual(after.enemies.filter(enemy => enemy.node.startsWith("tile-18:")).map(enemy => ({ id: enemy.id, missionId: enemy.missionId })),
    [{ id: after.mission.targets.bridge.enemyId, missionId: "bridge" }]);
  assert.equal(after.kills, before.kills); assert.equal(E.hunter(after).echoes, E.hunter(before).echoes);
  assert.equal(E.exportSave(before), saved); assert.deepEqual(E.importSave(E.exportSave(after)), after);
});
