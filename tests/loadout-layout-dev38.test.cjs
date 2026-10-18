"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), D = require("../src/hunt-data");
const { boot } = require("./helpers/ui-harness.cjs");
const key = "bloodborne-hunt-v07";
const make = (weapon, face = 0) => E.create(90, weapon, face, null,
  D.weapons[weapon].defaultFirearm, "center", { campaign: true, rulesVersion: 14 });
function launch(state) {
  return boot(state, E.missionView(state), E.rewardsView(state), {
    realInventory: true, storage: { [key]: E.exportSave(state) },
    engine: { ...E, applyTileSpeedRuling: s => s, applyChapelRuling: s => s,
      applyCombatReactionRuling: s => s, applyLeapMoveRuling: s => s },
  });
}
function slots(ui) { return ui.el("slots").querySelectorAll("[data-slot]"); }
function assertLoadout(ui, state) {
  const expected = E.slots(state);
  assert.equal(ui.el("weaponSlotBank").dataset.slotCount, String(expected.length));
  assert.equal(slots(ui).length, expected.length);
  expected.forEach((slot, index) => {
    assert.equal(slots(ui)[index].dataset.slot, String(index));
    assert(ui.el("slots").innerHTML.includes(slot.name));
  });
  assert.equal(ui.el("weaponName").textContent, E.weapon(state).name);
  assert.equal(ui.el("weaponFace").textContent, E.weaponFace(state).name.replace(/^(?:앞면|뒷면)\s*·\s*/, ""));
  assert(ui.el("firearm").innerHTML.includes(E.firearm(state).name));
}

for (const [weapon, face, count] of [["burial", 0, 3], ["kirkhammer", 1, 2], ["stake-driver", 1, 1]]) {
  test(`the relocated loadout keeps ${count} ${weapon} slots selectable without spending resources`, () => {
    const state = make(weapon, face), ui = launch(state), saved = ui.storage.get(key);
    assert.equal(E.slots(state).length, count); assertLoadout(ui, state);
    for (let index = 0; index < count; index++) {
      slots(ui)[index].click();
      assert(slots(ui)[index].classList.contains("selected"));
      assert.equal(ui.storage.get(key), saved);
      assertLoadout(ui, state);
    }
  });
}

for (const weapon of ["kirkhammer", "stake-driver"]) {
  test(`the ${weapon} preview changes between three and fewer slots without committing a weapon or firearm change`, () => {
    let state = make(weapon);
    state = E.dispatch(state, { type: "DREAM", cardId: E.hunter(state).hand[0].id });
    state = E.dispatch(state, { type: "REFILL", discardIds: [] });
    assert.equal(state.phase, "return");
    const ui = launch(state), saved = ui.storage.get(key), gun = ui.el("firearm").innerHTML;
    const choose = face => { ui.el("returnFace").value = String(face); ui.el("returnFace").fire("change"); };
    choose(1);
    assert.equal(slots(ui).length, E.weapon(state).faces[1].slots.length);
    assert(slots(ui).every(button => button.disabled));
    assert.equal(ui.el("weaponFace").textContent, E.weapon(state).faces[1].name);
    assert.equal(ui.el("weaponAbility").textContent, E.weapon(state).faces[1].text);
    assert.equal(ui.el("firearm").innerHTML, gun);
    assert.equal(ui.storage.get(key), saved);
    choose(0); assertLoadout(ui, state); assert.equal(ui.storage.get(key), saved);
    choose(1);
    const destination = ui.el("decisions").querySelectorAll("[data-return]")
      .find(button => button.dataset.return === "tile-14:center");
    assert(destination && !destination.disabled); destination.click();
    const expected = E.dispatch(state, { type: "RETURN", node: "tile-14:center", face: 1, reassignAttachments: true });
    assert.equal(ui.storage.get(key), E.exportSave(expected)); assertLoadout(ui, expected);
    assert.equal(E.hunter(expected).firearmId, E.hunter(state).firearmId);
    assert.equal(E.hunter(expected).hand.length, E.hunter(state).hand.length);
  });
}

test("a paid transformation redraws the new slot count and retains one functioning firearm control", () => {
  const state = make("stake-driver"), ui = launch(state), cardId = E.hunter(state).hand[0].id,
    initial = ui.storage.get(key), firearm = ui.el("firearm");
  const intent = ui.el("hunterActionBar").querySelectorAll("[data-hunter-intent]")
    .find(button => button.dataset.hunterIntent === "TRANSFORM");
  assert(intent && !intent.disabled); intent.click();
  assert.equal(ui.storage.get(key), initial);
  ui.el("hand").querySelectorAll("[data-card]").find(button => button.dataset.card === cardId).click();
  assert(!ui.el("confirmHunterAction").disabled); ui.el("confirmHunterAction").click();
  const expected = E.dispatch(state, { type: "TRANSFORM", cardId });
  assert.equal(ui.storage.get(key), E.exportSave(expected)); assertLoadout(ui, expected);
  assert.equal(ui.el("firearm"), firearm, "redraw updates the original firearm container");
  assert.equal(ui.buttons("firearm").filter(button => button.dataset.command === "FIREARM").length, 1);
  assert.equal(E.hunter(expected).hand.length, E.hunter(state).hand.length - 1);
});
