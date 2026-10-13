"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = require("../components/extended-weapons.json");
const W = require("../extended-weapons.js");

const printed = {
  "threaded-cane": [["3/1", "2/2", "2/2"], ["3/1", "2/2", "1/3"]],
  "hunter-axe": [["2/2", "2/2", "2/2"], ["2/2", "1/3", "1/3"]],
  "rifle-spear": [["2/2", "2/2", "2/2"], ["2/2", "2/2", "1/3"]],
  "saw-spear": [["3/1", "2/2", "1/3"], ["3/1", "3/1", "2/2"]],
  "uncanny-ludwigs-holy-blade": [["3/1", "3/1", "1/3"], ["2/2", "2/3"]],
  tonitrus: [["2/2", "2/2", "1/3"], ["2/2", "2/2", "1/3"]],
  "blade-of-mercy": [["2/2", "2/2", "1/3"], ["3/1", "3/1", "3/1"]],
  "ludwigs-holy-blade": [["2/2", "1/4"], ["3/1", "2/2", "2/2"]],
  "logarius-wheel": [["2/2", "1/3", "1/3"], ["2/2", "1/3", "1/3"]],
  kirkhammer: [["3/1", "2/2", "2/2"], ["1/3", "1/4"]],
  "stake-driver": [["2/2", "2/2", "1/3"], ["1/4"]],
  chikage: [["3/1", "2/2", "2/2"], ["3/1", "2/2", "2/2"]],
  "beast-claw": [["3/1", "2/2", "1/3"], ["3/1", "2/2", "1/3"]],
  reiterpallasch: [["3/1", "2/2", "1/3"], ["3/1", "2/2", "1/3"]],
};

test("all supplied weapon photos form fourteen distinct pairs with traceable source hashes", () => {
  assert.equal(source.schemaVersion, 1);
  assert.equal(source.sourceAudit.weaponCount, 14);
  assert.equal(source.sourceAudit.photoCount, 28);
  assert.equal(source.weapons.length, 14);
  assert.deepEqual(source.weapons.map((w) => w.id).sort(), Object.keys(printed).sort());
  const photos = [];
  for (const w of source.weapons) {
    assert.match(w.id, /^[a-z][a-z0-9-]*$/);
    assert.equal(w.faces.length, 2);
    assert.equal(new Set(w.faces.map((f) => f.id)).size, 2);
    assert.deepEqual(w.source, w.faces.map((f) => f.source));
    for (const f of w.faces) {
      photos.push(f.source.filename);
      assert.match(f.source.filename, /^20261011_\d{6}\.jpg$/);
      assert.match(f.source.sha256, /^[a-f0-9]{64}$/);
      assert.equal(path.win32.basename(f.source.path), f.source.filename);
      assert(Number.isFinite(Date.parse(f.source.lastModified)));
    }
  }
  assert.equal(new Set(photos).size, 28);
});

test("printed speed, damage and one-to-three slot counts are preserved for every supplied face", () => {
  for (const [id, faces] of Object.entries(printed)) {
    const weapon = W.definition(id);
    assert.deepEqual(weapon.faces.map((f) => f.slots.map((s) => `${s.speed}/${s.damage}`)), faces, id);
    weapon.faces.forEach((f) => f.slots.forEach((s, i) => {
      assert.equal(s.index, i);
      assert.equal(s.id, `slot-${i + 1}`);
      assert(s.name.length > 0);
    }));
  }
  assert.equal(W.definition("stake-driver").faces[1].slots.length, 1);
  assert.equal(W.definition("kirkhammer").faces[1].slots.length, 2);
  assert.equal(W.definition("ludwigs-holy-blade").faces[0].slots.length, 2);
  assert.equal(W.definition("uncanny-ludwigs-holy-blade").faces[1].slots.length, 2);
});

test("each bottom summary describes the opposite face and never becomes a second active effect", () => {
  for (const w of Object.values(W.weapons)) {
    w.faces.forEach((f, i) => {
      assert.deepEqual(f.oppositeFaceSummary.slots.map((s) => [s.speed, s.damage]),
        w.faces[1 - i].slots.map((s) => [s.speed, s.damage]), w.id);
      assert.equal(typeof f.text, "string");
      assert.equal(typeof f.effect.code, "string");
      assert(!Array.isArray(f.effect));
      assert(!("bottomEffect" in f));
    });
  }
  const cane = W.definition("threaded-cane");
  assert.equal(cane.faces[0].effect.code, "dodge_damage_all_within_one");
  assert.equal(cane.faces[1].effect.code, "stagger_equal_speed");
});

test("starting firearms follow the user supplied weapon-to-firearm text", () => {
  const src = source.sourceAudit.defaultFirearmSource;
  assert.equal(src.filename, "화기 관련 정보.txt");
  assert.match(src.sha256, /^[a-f0-9]{64}$/);
  assert(src.text.includes("칼날 지팡이 - 대포"));
  assert(src.text.includes("나머지 장치무기 - 야수 사냥의 단총"));
  const special = { "threaded-cane": "cannon", "uncanny-ludwigs-holy-blade": "repeating-pistol", "stake-driver": "repeating-pistol", "ludwigs-holy-blade": "evelyn" };
  for (const w of source.weapons) assert.equal(w.defaultFirearm, special[w.id] || "hunter-pistol", w.id);
});

test("named attacks retain their slot-specific effects without applying them to every slot", () => {
  assert.equal(W.definition("hunter-axe").faces[0].slots[2].code, "regain");
  assert.equal(W.definition("blade-of-mercy").faces[1].slots[2].code, "finishing_combo");
  for (const [id, face, slot] of [["uncanny-ludwigs-holy-blade", 1, 0], ["ludwigs-holy-blade", 0, 0], ["stake-driver", 0, 1]]) {
    const f = W.definition(id).faces[face];
    assert.equal(f.effect.code, "combo_after_attack_free_transform");
    assert.equal(f.effect.parameters.slot, slot);
    assert.equal(f.slots[slot].code, "combo_free_transform");
  }
  const hammer = W.definition("kirkhammer").faces[1];
  assert.equal(hammer.effect.parameters.slot, 1);
  assert.equal(hammer.slots[1].code, "destructive_no_interrupt_or_dodge");
  assert.equal(hammer.slots[0].code, undefined);
  const blast = W.definition("stake-driver").faces[1].slots[0];
  assert.deepEqual(blast.splash, { range: 1, damage: 2 });
  assert.equal(W.definition("reiterpallasch").faces[1].slots[1].code, "quicksilver_shot");
});

test("weapon face parameters preserve movement, healing, self-damage and dodge conditions", () => {
  const effect = (id, face) => W.definition(id).faces[face].effect;
  assert.deepEqual(effect("rifle-spear", 1).parameters, { damagePerAction: 1 });
  assert.deepEqual(effect("hunter-axe", 1).parameters, { range: 1, damage: 2 });
  assert.deepEqual(effect("saw-spear", 0).parameters, { draw: 1, heal: 1 });
  assert.deepEqual(effect("tonitrus", 0), effect("tonitrus", 1));
  assert.deepEqual(effect("logarius-wheel", 1).parameters, { maxSelfDamage: 2, damagePerSelfDamage: 1 });
  assert.deepEqual(effect("stake-driver", 1).parameters, { range: 1, maxDistance: 2 });
  assert.deepEqual(effect("chikage", 0).parameters, { selfDamage: 1, speed: 1, damage: 1 });
  assert.deepEqual(effect("chikage", 1).parameters, { heal: 1, damage: 1 });
  assert.deepEqual(effect("beast-claw", 0).parameters, { maxHp: 3, speed: 1, damage: 1 });
  assert.deepEqual(effect("beast-claw", 1).parameters, { heal: 2, move: 2 });
  assert.deepEqual(effect("reiterpallasch", 0).parameters, { damage: 2 });
});

test("offline browser mirror and UMD adapter match Node data without fetch or original JPG files", () => {
  assert.deepEqual(require("../components/extended-weapons.js"), source);
  const context = vm.createContext({});
  for (const file of ["../components/extended-weapons.js", "../extended-weapons.js"]) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, file), "utf8"), context);
  }
  const fromBrowser = JSON.parse(JSON.stringify(context.BBExtendedWeapons.source));
  assert.deepEqual(fromBrowser, source);
  assert.deepEqual(JSON.parse(JSON.stringify(context.BBExtendedWeapons.definition("stake-driver"))), W.definition("stake-driver"));
});

test("definitions and data application are independent copies and preserve the existing burial blade", () => {
  const first = W.definition("threaded-cane");
  first.faces[0].slots[0].damage = 99;
  assert.equal(W.definition("threaded-cane").faces[0].slots[0].damage, 1);
  assert.equal(W.definition("missing-weapon"), null);
  const data = { weapons: { burial: { name: "장송의 칼날" } }, cards: { keep: true } };
  const applied = W.applyTo(data);
  assert.equal(Object.keys(data.weapons).length, 1);
  assert.equal(Object.keys(applied.weapons).length, 15);
  assert.deepEqual(applied.weapons.burial, data.weapons.burial);
  assert.equal(applied.cards, data.cards);
  applied.weapons.tonitrus.faces[0].effect.parameters.speed = 9;
  assert.equal(W.definition("tonitrus").faces[0].effect.parameters.speed, 1);
});
