"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const H = require("../src/hunt-mission-hud"), U = require("../src/hunt-map-controls");
const E = require("../src/hunt-engine"), M = require("../src/chapter-engine");

function mission(revealed, extra = {}) {
  return { chapter: 2, revealed, discarded: [], completed: [], history: [], won: false,
    counters: ["corpses-held", "corpses", "survivors-held", "clinic", "chapel", "card-54", "card-57", "card-59"]
      .map(id => ({ id, value: 0 })), tokens: [], targets: [], ...extra };
}
const ids = list => list.map(item => item.id);

test("mission HUD exposes corpse counters only while the revealed corpse objective remains open", () => {
  assert.deepEqual(ids(H.view(mission([18])).counters), ["corpses-held", "corpses"]);
  assert.deepEqual(H.view(mission([18, 19])).counters, []);
  assert.deepEqual(H.view(mission([40, 41], { chapter: 3 })).counters, []);
});
test("survivor counters belong to the current revealed shelter mission and disappear when completed or blocked", () => {
  assert.deepEqual(ids(H.view(mission([27])).counters), ["survivors-held", "clinic"]);
  assert.deepEqual(ids(H.view(mission([33])).counters), ["survivors-held", "chapel"]);
  assert.deepEqual(H.view(mission([27], { completed: [28] })).counters, []);
  assert.deepEqual(H.view(mission([52], { history: [{ completed: [34] }] })).counters, []);
  assert.deepEqual(H.view(mission([33], { history: [{ completed: [28] }] })).counters, []);
});
test("mission-specific progress does not leak from unrevealed, discarded or completed cards", () => {
  assert.deepEqual(ids(H.view(mission([54, 57, 59], { chapter: 3 })).counters), ["card-54", "card-57", "card-59"]);
  assert.deepEqual(ids(H.view(mission([54, 57, 59], { chapter: 3, completed: [55, 58], discarded: [59] })).counters), []);
  assert.deepEqual(H.view(mission([])).counters, []);
});
test("tokens follow their live escort, rescue and NPC missions without changing their canonical locations", () => {
  const tokens = [{ id: "escort", node: "tile-11:home" }, { id: "rescue", node: "tile-03:top" }, { id: "salvation-npc", node: "tile-17:top" }];
  const publicView = mission([8, 13], { chapter: 1, tokens }), before = JSON.stringify(publicView);
  assert.deepEqual(ids(H.view(publicView).tokens), ["escort", "rescue"]);
  assert.equal(JSON.stringify(publicView), before);
  assert.deepEqual(ids(H.view(mission([37, 49, 57], { chapter: 3, tokens })).tokens), ["escort", "rescue", "salvation-npc"]);
  assert.deepEqual(H.view(mission([37, 49, 57], { chapter: 3, tokens, completed: [39, 50, 58] })).tokens, []);
});
test("only currently revealed enemies with mission insight tokens appear, retaining zero before final defeat", () => {
  const targets = [{ id: "main", card: 3, tokens: 0, initialTokens: 0 },
    { id: "patient", card: 31, tokens: 0, initialTokens: 2 },
    { id: "bridge", card: 36, tokens: 1, initialTokens: 1 },
    { id: "shelter", card: 10, tokens: 2, initialTokens: 2, complete: true }];
  const view = mission([3, 31, 10], { targets });
  assert.deepEqual(ids(H.view(view).targets), ["patient"]);
  assert.deepEqual(H.view({ ...view, discarded: [31] }).targets, []);
  assert.deepEqual(H.view({ ...view, won: true }), { counters: [], tokens: [], targets: [] });
});
test("single-space inspection shows only the chosen cell, retaining its tile-wide rules and actual objects", () => {
  const state = E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13 });
  const before = E.exportSave(state), all = U.tileInfo(state, "tile-14");
  assert.equal(all.spaces.length, M.tile("tile-14").spaces.length);
  const left = U.tileInfo(state, "tile-14", { node: "tile-14:left", selectedOnly: true });
  assert.equal(left.selectedNode, "tile-14:left");
  assert.deepEqual(left.spaces.map(space => space.node), ["tile-14:left"]);
  assert.deepEqual(left.rules, all.rules);
  assert.equal(left.spaces[0].atHunter, false);
  assert(!left.spaces[0].interactions.some(text => text.includes("순간이동")), "the lamp interaction belongs to the central cell only");
  const current = U.tileInfo(state, "tile-14", { selectedOnly: true });
  assert.deepEqual(current.spaces.map(space => space.node), [E.hunter(state).position]);
  assert.equal(E.exportSave(state), before);
});
test("inspection cannot select a cell from another tile or expose the undrawn tile deck", () => {
  const state = E.create(90, "beast-claw", 0, null, "hunter-pistol", "left", { campaign: true, rulesVersion: 13 });
  const view = U.tileInfo(state, "tile-14", { node: "tile-11:home", selectedOnly: true });
  assert.equal(view.selectedNode, "tile-14:left");
  assert.equal(view.spaces.length, 1);
  assert.equal(U.tileInfo(state, state.world.tileDeck[0], { selectedOnly: true }), null);
});
