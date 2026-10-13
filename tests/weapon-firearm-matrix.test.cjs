"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../hunt-engine.js");
const weapons = Object.keys(E.data.weapons).filter(id => id !== "training");
const guns = ["hunter-pistol", "evelyn", "cannon", "repeating-pistol", "rosmarinus", "flamesprayer", "ludwig-rifle", "hunter-blunderbuss"];
// These are real practice encounters, created and advanced exclusively through
// the public reducer. No hand, HP, deck order, enemy or reward is injected.
// Seed 4 naturally opens with Strength, Endurance, Vitality and a Basic attack.
const rulesVersion = 12;
const go = (s, type, args = {}) => {
  const next = E.dispatch(s, { type, ...args });
  E.assertState(next);
  assert.equal(E.hunter(next).slots.length, E.slots(next).length);
  return next;
};
const replay = s => {
  const restored = E.importSave(E.exportSave(s));
  assert.deepEqual(restored, s);
  return restored;
};
function dodgeCommand(s) {
  const h = E.hunter(s);
  for (const c of h.hand) for (let i = 0; i < h.slots.length; i++)
    if (E.canDodge(s, c.id, i)) return { type: "DODGE", cardId: c.id, slot: i };
  return null;
}
function settle(s, options = {}) {
  for (let n = 0; n < 80; n++) {
    const h = E.hunter(s);
    if (s.phase === "hunter" || s.phase === "refill" || s.phase === "over") return s;
    let command;
    switch (s.phase) {
      case "combat_choose": command = { type: "NO_ATTACK" }; break;
      case "combat_react": command = dodgeCommand(s) || { type: "RESOLVE" }; break;
      case "free_transform": command = { type: "FREE_TRANSFORM", accept: false }; break;
      case "weapon_choice": {
        const choices = E.weaponChoices(s), choice = choices.find(c => c.command.stop) || choices.find(c => !c.disabled);
        assert(choice, "a weapon continuation must offer a legal choice"); command = choice.command; break;
      }
      case "weapon_entry": command = { type: "ENTRY_WEAPON", accept: false }; break;
      case "firearm_react": command = { type: "FIREARM_ENTRY", accept: options.fireRifle === true }; break;
      case "move": command = { type: "STOP_MOVE" }; break;
      case "enemy_path": command = { type: "ENEMY_STEP", node: E.moveOptions(s)[0] }; break;
      case "activation": command = { type: "ACTIVATE", enemyId: E.eligible(s)[0].id }; break;
      case "stun": command = { type: "STUN_DISCARD", cardId: h.hand[0].id }; break;
      case "card_choice": {
        const choice = s.cardChoices[0];
        command = { type: "CARD_CHOICE", value: choice.type === "discard" ? h.hand[0]?.id :
          choice.type === "status" ? Object.keys(h.status).find(k => h.status[k]) : h.slots.findIndex(Boolean) }; break;
      }
      case "ability_choice": command = { type: "ABILITY_CHOICE", cardId: h.hand[0]?.id }; break;
      case "cheap_shot": command = { type: "CHEAP_SHOT" }; break;
      default: throw new Error(`unhandled natural matrix phase ${s.phase}`);
    }
    s = go(s, command.type, command);
  }
  throw new Error("natural matrix continuation did not settle");
}
function refillAndReturn(s, face) {
  if (s.phase === "refill") s = go(s, "REFILL");
  for (let n = 0; n < 10 && ["upgrade_pick", "upgrade_replace"].includes(s.phase); n++) {
    if (s.phase === "upgrade_pick") s = go(s, "PICK_UPGRADE", { index: s.market.findIndex(Boolean) });
    else s = go(s, "REPLACE_UPGRADE", { replaceId: E.hunter(s).deck[0].id });
  }
  if (s.phase === "return") {
    s = go(s, "RETURN", { node: E.nodes(s).find(n => n.lamp).id, face });
    assert.equal(E.hunter(s).face, face);
    assert.equal(E.hunter(s).hp, 6);
  }
  assert.equal(s.phase, "hunter");
  return s;
}
function roundUntilHand(s, face) {
  for (let i = 0; E.hunter(s).hand.length === 0 && i < 4; i++) {
    s = settle(go(s, "END_TURN"));
    s = refillAndReturn(s, face);
  }
  assert(E.hunter(s).hand.length > 0, "a real subsequent round supplies action cards");
  return s;
}

test("matrix includes precisely all fifteen weapons and all eight playable firearms", () => {
  assert.equal(weapons.length, 15); assert.equal(guns.length, 8);
});

for (const rulesVersion of [10, 11, 12, 13]) for (const id of weapons) for (const face of [0, 1]) for (const gun of guns) {
  test(`public encounter and save replay v${rulesVersion}: ${id}, face ${face}, ${gun}`, () => {
    let s = E.create(4, id, face, null, gun, "center", {
      campaign: false, rulesVersion, firearmOverride: gun !== (E.data.weapons[id].defaultFirearm || "hunter-pistol"),
      practiceTarget: "church-giant", practiceSide: "a",
    });
    assert.equal(E.hunter(s).hand.find(c => c.kind === "strength").id, "card-8");
    assert.equal(s.enemyDeck[0], "basic");
    const def = E.firearm(s), initialDeck = structuredClone(s.enemyDeck);
    if (gun === "ludwig-rifle") {
      s = go(s, "MOVE", { cardId: E.hunter(s).hand[0].id });
      s = go(s, "STEP", { node: "tile-14:left" });
      s = settle(s, { fireRifle: true });
      if (E.hunter(s).firearmReady) s = settle(go(s, "END_TURN"), { fireRifle: true });
      assert(s.commands.some(c => c.type === "FIREARM_ENTRY" && c.accept));
    } else if (def.trigger === "hunter-turn" || def.trigger === "hunter-effect") {
      s = go(s, "FIREARM", { enemyId: s.enemies[0].id });
      if (gun === "hunter-blunderbuss") {
        assert.deepEqual(s.enemyDeck, initialDeck, "shotgun effect reveals no enemy action");
        assert.equal(s.combat, null);
      } else {
        assert.equal(s.combat.attack, null, "standalone firearm spends no attack-slot card");
        assert.equal(s.combat.flame.interrupt, gun === "flamesprayer");
        assert.equal(s.combat.flame.splash, gun === "flamesprayer" ? 1 : 0);
      }
      s = settle(s);
    } else {
      s = go(s, "ATTACK", { enemyId: s.enemies[0].id, cardId: "card-8", slot: 0 });
      assert.equal(s.combat.action.kind, "basic");
      assert(E.canFirearm(s), `${gun} is legal at its printed enemy-attack trigger`);
      s = go(s, "FIREARM");
      if (gun === "rosmarinus") {
        assert.equal(s.combat.action.speed, 0);
        assert.equal(s.combat.removeEnemyAttackEffects, true);
        s = go(s, "RESOLVE");
      } else assert.equal(s.combat.cancelEnemy, true);
      s = settle(s);
    }
    assert.equal(E.hunter(s).firearmReady, false, "using the gun exhausts it");
    s = replay(s);
    if (s.phase === "refill") s = refillAndReturn(s, face);
    const prepareCost = def.prepareCost || 1;
    assert(E.hunter(s).hand.length >= prepareCost, "the natural encounter leaves enough preparation cards");
    const spent = E.hunter(s).hand.slice(0, prepareCost).map(c => c.id), handBefore = E.hunter(s).hand.length;
    s = go(s, "RELOAD", { cardIds: spent, cardId: spent[0] });
    assert.equal(E.hunter(s).hand.length, handBefore - prepareCost);
    assert.equal(E.hunter(s).firearmReady, true);
    s = replay(s);

    s = roundUntilHand(s, face);
    const beforeFace = E.hunter(s).face;
    s = go(s, "TRANSFORM", { cardId: E.hunter(s).hand[0].id });
    assert.equal(E.hunter(s).face, 1 - beforeFace);
    assert(E.hunter(s).slots.every(c => c === null));
    s = settle(s); s = roundUntilHand(s, 1 - face);
    s = go(s, "DREAM", { cardId: E.hunter(s).hand[0].id });
    assert.equal(E.hunter(s).inDream, true);
    assert.equal(E.hunter(s).hp, 6);
    assert.equal(E.hunter(s).firearmReady, true);
    assert(E.hunter(s).slots.every(c => c === null));
    assert(s.round >= 2, "the trace crosses a round boundary");
    s = replay(s);
    s = refillAndReturn(s, 1 - face);
    assert.equal(E.hunter(s).inDream, false);
    assert.equal(E.hunter(s).face, 1 - face);
    assert.equal(E.hunter(s).slots.length, E.data.weapons[id].faces[1 - face].slots.length);
    assert(s.commands.length >= 8);
    s = replay(s);
    // Also declare a real stat-card attack in every gun pairing. Standalone
    // cannon/flame/shotgun routes therefore do not merely cover their guns.
    const enemyId = s.enemies[0].id;
    if (s.enemies[0].node !== E.hunter(s).position) {
      const targetNode = s.enemies[0].node;
      s = go(s, "MOVE", { cardId: E.hunter(s).hand[0].id });
      for (let n = 0; s.phase === "move" && E.hunter(s).position !== targetNode && n < 2; n++)
        s = go(s, "STEP", { node: E.path(s, E.hunter(s).position, targetNode)[1] });
      s = settle(s);
    }
    assert.equal(s.enemies.find(e => e.id === enemyId).node, E.hunter(s).position);
    const stat = E.hunter(s).hand.find(c => c.kind === "strength") || E.hunter(s).hand[0];
    assert(stat);
    s = go(s, "ATTACK", { enemyId, cardId: stat.id, slot: 0 });
    s = replay(s);
    if (s.phase === "combat_react" && E.canFirearm(s)) s = go(s, "FIREARM");
    s = settle(s);
    replay(s);
  });
}

test("each weapon uses its printed starting gun and requires explicit campaign override for alternatives", () => {
  for (const id of weapons) {
    const normal = E.data.weapons[id].defaultFirearm || "hunter-pistol";
    const s = E.create(4, id, 0, null, normal, "center", { campaign: true, rulesVersion });
    assert.equal(E.hunter(s).firearmId, normal);
    const other = guns.find(gun => gun !== normal);
    assert.throws(() => E.create(4, id, 0, null, other, "center", { campaign: true, rulesVersion }));
    const alternate = E.create(4, id, 1, null, other, "center", { campaign: true, rulesVersion, firearmOverride: true });
    assert.equal(alternate.setup.firearmOverride, true);
    replay(alternate);
  }
});

test("natural rifle-spear entry can spend a dormant card before the rifle fires at the same entry", () => {
  let s = E.create(4, "rifle-spear", 0, null, "ludwig-rifle", "center", {
    campaign: false, rulesVersion, firearmOverride: true, practiceTarget: "church-giant", practiceSide: "a",
  });
  s = go(s, "MOVE", { cardId: "card-2" });
  s = go(s, "STEP", { node: "tile-14:left" });
  s = go(s, "STOP_MOVE");
  assert.equal(s.phase, "weapon_entry");
  const handBefore = E.hunter(s).hand.length, deckBefore = structuredClone(s.enemyDeck);
  s = replay(s);
  s = go(s, "ENTRY_WEAPON", { accept: true, cardId: "card-11", slot: 0 });
  assert.equal(s.phase, "firearm_react");
  assert.equal(s.enemies[0].hp, 4);
  assert.equal(E.hunter(s).hand.length, handBefore - 1, "Vitality's draw stays dormant face down");
  assert.equal(E.hunter(s).slots[0].faceDown, true);
  s = replay(s);
  s = go(s, "FIREARM_ENTRY", { accept: true });
  assert.equal(s.enemies[0].hp, 2);
  assert.equal(E.hunter(s).firearmReady, false);
  assert.deepEqual(s.enemyDeck, deckBefore, "neither entry effect reveals an enemy action");
  s = settle(s);
  assert.equal(s.phase, "hunter");
  replay(s);
});

test("natural Tonitrus charge modifies the first cannon attack and is consumed before a prepared second shot", () => {
  let s = E.create(4, "tonitrus", 0, null, "cannon", "center", {
    campaign: false, rulesVersion, firearmOverride: true, practiceTarget: "church-giant", practiceSide: "a",
  });
  s = go(s, "TRANSFORM", { cardId: "card-2" });
  assert.deepEqual(E.hunter(s).weaponCharge, { round: 1, speed: 1, damage: 1 });
  s = go(s, "FIREARM", { enemyId: s.enemies[0].id });
  assert.equal(s.combat.flame.speed, 2); assert.equal(s.combat.flame.damage, 4);
  assert.equal(E.hunter(s).weaponCharge, undefined);
  s = go(s, "RESOLVE");
  assert.equal(s.phase, "hunter"); assert.equal(s.enemies[0].hp, 2);
  assert.equal(E.hunter(s).hp, 2);
  s = go(s, "RELOAD", { cardIds: E.hunter(s).hand.map(c => c.id) });
  s = go(s, "FIREARM", { enemyId: s.enemies[0].id });
  assert.equal(s.combat.flame.speed, 1); assert.equal(s.combat.flame.damage, 3);
  replay(s);
});

test("the thirty default combinations finish multi-round public campaign traces and replay their terminal states", () => {
  const { run } = require("./weapon-firearm-hunt-qa.cjs");
  let commands = 0, checkpoints = 0;
  for (const id of weapons) for (const face of [0, 1]) {
    const row = run(id, face, 90, rulesVersion);
    assert.equal(row.result, "loss", "the bounded exploration policy is not a campaign solver");
    assert.equal(row.chapter, 1); assert(row.rounds >= 9); assert(row.commands >= 90);
    commands += row.commands; checkpoints += row.replayCheckpoints;
  }
  assert(commands > 3000); assert(checkpoints >= 100);
});

function rewardedPractice(id, face, gun, practiceRewards) {
  return E.create(4, id, face, null, gun, "center", {
    campaign: false, rulesVersion, firearmOverride: true, practiceTarget: "church-giant", practiceSide: "a", practiceRewards,
  });
}
const rewardId = (s, kind) => E.hunter(s).rewards.find(r => r.kind === kind).id;
function stopOptionalWeaponPushes(s) {
  for (let n = 0; s.phase === "weapon_choice" && n < 8; n++) {
    const choice = E.weaponChoices(s).find(c => c.command.stop);
    assert(choice, "only optional Stake Driver pushes precede this free transform");
    s = go(s, choice.command.type, choice.command);
  }
  return s;
}

test("Writhe alone lets all thirty weapon faces stagger a same-speed cannon exchange", () => {
  for (const id of weapons) for (const face of [0, 1]) {
    let s = rewardedPractice(id, face, "cannon", ["rune-writhe"]);
    s = go(s, "FIREARM", { enemyId: s.enemies[0].id, rewardIds: [rewardId(s, "rune-writhe")] });
    assert.equal(s.combat.flame.speed, s.combat.action.speed);
    assert.equal(s.combat.flame.interrupt, true);
    assert.equal(s.combat.flame.interruptEqual, true);
    s = replay(s); s = go(s, "RESOLVE"); s = stopOptionalWeaponPushes(s);
    assert.equal(E.hunter(s).hp, 6, `${id}/${face} same-speed enemy damage is canceled`);
    assert.equal(s.enemies[0].hp, 6 - 3 - (id === "saw-spear" && face === 1 ? 1 : 0));
    assert.equal(s.phase, "hunter"); replay(s);
  }
});

for (const id of weapons) for (const face of [0, 1]) for (const gun of ["cannon", "flamesprayer"]) {
  test(`public broad attack rewards on standalone firearm: ${id}, face ${face}, ${gun}`, () => {
    const kinds = ["rune-writhe", "rune-hunter", "empty-shell"];
    let s = rewardedPractice(id, face, gun, kinds), before = structuredClone(E.hunter(s).hand);
    const rewardIds = kinds.map(kind => rewardId(s, kind));
    assert(E.hunter(s).rewards.every(r => r.equipped && r.ready));
    s = go(s, "FIREARM", { enemyId: s.enemies[0].id, rewardIds });
    assert.deepEqual(E.hunter(s).hand, before, "broad attack rewards use no stat card");
    assert.equal(s.combat.flame.speed, (gun === "cannon" ? 1 : 2) + 2);
    assert.equal(s.combat.flame.damage, (gun === "cannon" ? 3 : 2) + 1 + (id === "saw-spear" && face === 1 ? 1 : 0));
    assert.equal(s.combat.flame.interrupt, true);
    assert.equal(s.combat.flame.interruptEqual, true);
    assert.equal(s.combat.flame.freeTransform, true);
    assert(E.hunter(s).rewards.every(r => !r.ready));
    s = replay(s);
    s = go(s, "RESOLVE");
    assert.equal(E.hunter(s).hp, 6, "faster stagger stops the printed Giant attack");
    s = stopOptionalWeaponPushes(s);
    assert.equal(s.phase, "free_transform");
    s = go(s, "FREE_TRANSFORM", { accept: true });
    assert.equal(E.hunter(s).face, 1 - face);
    assert(E.hunter(s).slots.every(c => c === null));
    assert.deepEqual(E.hunter(s).hand, before, "the rune transform is free");
    assert.equal(E.hunter(s).firearmReady, false);
    s = replay(s);
    s = go(s, "DREAM", { cardId: E.hunter(s).hand[0].id });
    assert(E.hunter(s).rewards.every(r => r.ready), "Dream refreshes all consumed attack rewards");
    replay(s);
  });
}

for (const id of weapons) for (const face of [0, 1]) {
  test(`public Clawmark replacement suppresses draw and clear: ${id}, face ${face}`, () => {
    for (const cardId of ["card-11", "card-2"]) {
      let s = rewardedPractice(id, face, "hunter-pistol", ["rune-clawmark"]);
      const rune = rewardId(s, "rune-clawmark");
      s = go(s, "ATTACK", { enemyId: s.enemies[0].id, cardId, slot: 0, rewardIds: [rune] });
      assert.equal(E.hunter(s).hand.length, 2, "replacement suppresses Vitality draw");
      assert.equal(E.hunter(s).slots[0].id, cardId, "replacement suppresses Endurance clear");
      assert.equal(s.combat.attack.interrupt, true);
      assert.equal(s.combat.attack.damage, E.slots(s)[0].damage + 1 + (id === "saw-spear" && face === 1 ? 1 : 0));
      assert.equal(E.hunter(s).rewards[0].ready, false);
      s = replay(s); s = settle(s); replay(s);
    }
  });
}

test("every standalone gun pairing rejects a Clawmark replacement before exhausting the gun or rune", () => {
  for (const id of weapons) for (const face of [0, 1]) for (const gun of ["cannon", "flamesprayer"]) {
    const s = rewardedPractice(id, face, gun, ["rune-clawmark"]), before = structuredClone(s);
    assert.throws(() => go(s, "FIREARM", { enemyId: s.enemies[0].id, rewardIds: [rewardId(s, "rune-clawmark")] }));
    assert.deepEqual(s, before, `${id}/${face}/${gun} rejects stat replacement atomically`);
  }
});

for (const [id, face] of [["ludwigs-holy-blade", 0], ["uncanny-ludwigs-holy-blade", 1], ["kirkhammer", 1], ["stake-driver", 1]]) {
  test(`public Hunter-rune free transform prepares the repeating pistol: ${id}, face ${face}`, () => {
    let s = rewardedPractice(id, face, "repeating-pistol", ["rune-hunter"]);
    s = go(s, "ATTACK", { enemyId: s.enemies[0].id, cardId: "card-8", slot: 0, rewardIds: [rewardId(s, "rune-hunter")] });
    s = go(s, "FIREARM");
    assert.equal(E.hunter(s).firearmReady, false);
    s = go(s, "RESOLVE");
    s = stopOptionalWeaponPushes(s);
    assert.equal(s.phase, "free_transform");
    const handBefore = structuredClone(E.hunter(s).hand);
    s = go(s, "FREE_TRANSFORM", { accept: true });
    assert.equal(E.hunter(s).firearmReady, true);
    assert.equal(E.hunter(s).face, 1 - face);
    assert.deepEqual(E.hunter(s).hand, handBefore);
    assert.equal(E.hunter(s).slots.length, 3);
    replay(s);
  });
}

for (const [id, face] of [["ludwigs-holy-blade", 1], ["uncanny-ludwigs-holy-blade", 0], ["kirkhammer", 0], ["stake-driver", 0]]) {
  test(`public Chunk and Tear Gem reattach after slot reduction and modify only the stat attack: ${id}`, () => {
    let s = rewardedPractice(id, face, "cannon", ["bloodstone-chunk", "tear-gem"]);
    const chunk = rewardId(s, "bloodstone-chunk"), tear = rewardId(s, "tear-gem");
    assert.equal(s.rewardChoices.length, 2);
    for (const r of [chunk, tear]) s = go(s, "EQUIP_REWARD", { rewardId: r, slot: 2 });
    s = go(s, "FIREARM", { enemyId: s.enemies[0].id });
    assert.equal(s.combat.flame.speed, 1); assert.equal(s.combat.flame.damage, 3);
    s = go(s, "RESOLVE");
    assert.equal(E.hunter(s).hp, 2, "real Giant damage sets up the Gem heal");
    s = go(s, "TRANSFORM", { cardId: "card-2" });
    assert(E.hunter(s).slots.length < 3);
    assert.equal(s.rewardChoices.length, 2);
    assert(E.hunter(s).rewards.every(r => !r.equipped && r.slot === null));
    s = replay(s);
    for (const r of [chunk, tear]) s = go(s, "EQUIP_REWARD", { rewardId: r, slot: 0 });
    s = go(s, "ATTACK", { enemyId: s.enemies[0].id, cardId: "card-8", slot: 0 });
    assert.equal(E.hunter(s).hp, 3);
    assert.equal(s.combat.attack.speed, E.slots(s)[0].speed + 1);
    assert.equal(s.combat.attack.damage, E.slots(s)[0].damage + 2);
    assert(E.hunter(s).rewards.every(r => r.ready));
    s = replay(s); s = settle(s); replay(s);
  });
}

test("fixture: stopping a later pursuer with the Torch cannot erase an earlier completed pursuit", () => {
  // Focused mission fixture: the two pursuers and already-active survivor
  // mission are arranged explicitly. Unlike the matrix traces above, this
  // fixture does not claim a natural mission path or command-save replay.
  const R = require("../rewards-engine.js");
  let s = E.create(4, "burial", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion });
  R.grant(s, "hunter-torch");
  s.world.assignments.find(a => a.enemyId === "huntsman-mob").sideId = "a";
  s.enemies = [1, 2].map(figure => ({ id: `huntsman-mob-${figure}`, kind: "huntsman-mob", figure,
    node: "tile-14:center", hp: 4 }));
  s.mission.revealed.push(12, 13); s.mission.survivor.node = "tile-14:left";
  E.assertState(s);
  s = go(s, "MOVE", { cardId: E.hunter(s).hand[0].id });
  s = go(s, "STEP", { node: "tile-14:left" });
  s = go(s, "STOP_MOVE");
  assert.equal(s.phase, "reward_entry"); assert.equal(s.firearmEntry.enemyId, "huntsman-mob-1");
  s = go(s, "ENTRY_REWARD", { accept: false });
  assert.equal(s.phase, "reward_entry"); assert.equal(s.firearmEntry.enemyId, "huntsman-mob-2");
  assert.equal(s.enemies.find(e => e.figure === 1).node, E.hunter(s).position);
  s = go(s, "ENTRY_REWARD", { accept: true, node: "tile-14:center" });
  assert.equal(s.phase, "hunter", "an earlier pursuer still blocks the survivor decision");
  assert.equal(s.enemies.find(e => e.figure === 2).node, "tile-14:center");
  assert(!s.mission.revealed.includes(14));
  E.assertState(JSON.parse(JSON.stringify(s)));
});
