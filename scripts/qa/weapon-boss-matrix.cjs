#!/usr/bin/env node
"use strict";

/**
 * Arranged-state semantic matrix for the implemented Cleric Beast.
 *
 *   node scripts/qa/weapon-boss-matrix.cjs
 *   node scripts/qa/weapon-boss-matrix.cjs --input-root PATH --output-root PATH
 *
 * Input defaults to this repository; a frozen text snapshot may be supplied.
 * Current policy adoption is the default. --policy legacy leaves initial
 * policy markers as E.create supplies them. No browser, server, git mutation,
 * natural campaign route, or full firearm/boss Cartesian product is involved.
 */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repositoryRoot = path.resolve(__dirname, "../..");

function argumentsFor(argv) {
  const options = {
    inputRoot: repositoryRoot,
    outputRoot: path.join(repositoryRoot, "test-results/campaign-matrix-dev28/weapon-boss/current"),
    policy: "current",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/qa/weapon-boss-matrix.cjs [--input-root PATH] [--output-root PATH] [--policy current|legacy]");
      process.exit(0);
    }
    const key = { "--input-root": "inputRoot", "--output-root": "outputRoot", "--policy": "policy" }[arg];
    if (!key || !argv[i + 1]) throw new Error("Unknown option or missing value: " + arg);
    options[key] = argv[++i];
  }
  if (!["current", "legacy"].includes(options.policy)) throw new Error("Policy must be current or legacy");
  options.inputRoot = path.resolve(options.inputRoot);
  options.outputRoot = path.resolve(options.outputRoot);
  return options;
}

const options = argumentsFor(process.argv.slice(2));
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const relativeInput = filename => path.relative(options.inputRoot, filename).split(path.sep).join("/");
const insideInput = filename => {
  const relative = path.relative(options.inputRoot, filename);
  return relative !== "" && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
};

// Keep the exact JavaScript text presented to Node separate from disk hashes.
// JSON receives before/after read fingerprints without replacing Node's loader.
const loadedSources = {};
const compile = Module.prototype._compile;
const loadJson = Module._extensions[".json"];
Module.prototype._compile = function (content, filename) {
  if (insideInput(filename)) {
    loadedSources[relativeInput(filename)] = { kind: "compiled-js", sha256: hash(content) };
  }
  return compile.call(this, content, filename);
};
Module._extensions[".json"] = function (module, filename) {
  const before = fs.readFileSync(filename);
  try {
    return loadJson(module, filename);
  } finally {
    if (insideInput(filename)) {
      const after = fs.readFileSync(filename);
      loadedSources[relativeInput(filename)] = {
        kind: "json-loader", sha256: hash(before), stableDuringLoad: hash(before) === hash(after),
      };
    }
  }
};

let E, B;
try {
  E = require(path.join(options.inputRoot, "src/hunt-engine.js"));
  B = require(path.join(options.inputRoot, "src/boss-components.js"));
} finally {
  Module.prototype._compile = compile;
  Module._extensions[".json"] = loadJson;
}

const sourceFiles = Object.keys(loadedSources).sort();
function sourceFingerprint() {
  return Object.fromEntries(sourceFiles.map(file => [file, hash(fs.readFileSync(path.join(options.inputRoot, file)))]));
}
function sourceFileTimes() {
  return Object.fromEntries(sourceFiles.map(file => {
    const stat = fs.statSync(path.join(options.inputRoot, file));
    return [file, { bytes: stat.size, mtimeUtc: stat.mtime.toISOString() }];
  }));
}
function gitIdentity() {
  try {
    const top = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: options.inputRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    // A snapshot nested in a git checkout is not itself that checkout.
    if (path.resolve(top).toLowerCase() !== options.inputRoot.toLowerCase()) return null;
    return {
      head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: top, encoding: "utf8" }).trim(),
      status: execFileSync("git", ["status", "--porcelain"], { cwd: top, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean),
    };
  } catch {
    return null;
  }
}

const initialSources = sourceFingerprint();
const initialFileTimes = sourceFileTimes();
const loadedMatchesDisk = sourceFiles.every(file => {
  const loaded = loadedSources[file];
  const contents = fs.readFileSync(path.join(options.inputRoot, file), "utf8");
  // Node may remove a UTF-8 BOM before compiling JavaScript.
  const diskHash = hash(loaded.kind === "compiled-js" ? contents.replace(/^\uFEFF/, "") : contents);
  return loaded.sha256 === diskHash && loaded.stableDuringLoad !== false;
});
const weapons = Object.entries(E.data.weapons).filter(([id]) => id !== "training");
const actions = B.specimen.phases.flatMap((phase, index) =>
  Object.entries(phase.actions).map(([id, action]) => ({ phase: index + 1, id, action })));
assert.equal(weapons.length, 15, "Matrix scope changed: review normal weapon inventory");
assert.equal(actions.length, 9, "Matrix scope changed: review phase-specific boss actions");

const requireMovementMarker = options.policy === "current" && typeof E.applyMovementDeclarationRuling === "function";
const out = {
  schemaVersion: 2,
  classification: "Engine synthetic arranged-state semantic matrix; not browser QA or a natural campaign trace.",
  inputRoot: options.inputRoot,
  policy: options.policy,
  git: gitIdentity(),
  initial: { source: initialSources, fileTimes: initialFileTimes },
  loadedSources,
  loadedMatchesDisk,
  inventory: {
    weapons: weapons.map(([id, weapon]) => ({
      id, name: weapon.name, defaultFirearm: weapon.defaultFirearm || "hunter-pistol",
      faces: weapon.faces.map((face, index) => ({
        face: index, name: face.name, slots: face.slots, effect: face.effect || null,
      })),
    })),
    boss: B.specimen,
    // Inventory only: these definitions do not imply every firearm was fired.
    firearms: Object.keys(E.data.firearms).map(id => ({
      id,
      ...E.firearm(E.create(4, "burial", 0, null, id, "center",
        { campaign: false, rulesVersion: 14, firearmOverride: true })),
    })),
  },
  baseCombinations: weapons.length * 2 * actions.length,
  rows: [],
  failures: [],
  checks: {
    dispatches: 0, policyDispatches: 0, serializedCheckpoints: 0,
    legalDodges: 0, illegalDodgeAtomicity: 0, bossInsightOffers: 0,
    scalarOutcomes: 0, leapFollowups: 0,
  },
  adoptedPolicies: {},
  limits: [
    "One implemented real boss, Cleric Beast, two phases and nine phase-specific unique actions. Provisional authored boss is excluded.",
    "Fifteen normal weapons, both faces and every attack slot; four basic stat cards, resolve/dodge, legal Wheel/Chikage boosts and three weapon contexts.",
    "Default carried firearms are inventory context. Eight-firearm by boss firing coverage, reward/consumable Cartesian products, all hands, movement costs and actual PC campaign coverage are not claimed.",
    "Fixtures arrange boss phase/deck, hand, weapon context and optionally health. E.importSave replay is not claimed for these arranged states.",
    "Every arranged fixture and combat dispatch checks E.assertState and exact export JSON state preservation. Natural public-command save replay is covered separately.",
  ],
};

function adoptPolicies(s, weaponId) {
  if (options.policy === "current") {
    for (const name of ["applyChapelRuling", "applyCombatReactionRuling", "applyTileSpeedRuling",
      "applyLeapMoveRuling", "applyMovementDeclarationRuling"]) {
      if (typeof E[name] === "function") {
        const before = s.commands.length;
        s = E[name](s);
        out.checks.policyDispatches += s.commands.length - before;
      }
    }
  }
  if (requireMovementMarker) assert.equal(s.movementDeclarationRuling, "first-step");
  const policies = Object.fromEntries(Object.keys(s).filter(key => key.endsWith("Ruling")).map(key => [key, s[key]]));
  if (!out.adoptedPolicies[weaponId]) out.adoptedPolicies[weaponId] = policies;
  else assert.deepEqual(policies, out.adoptedPolicies[weaponId]);
  return s;
}

function checkpoint(s) {
  E.assertState(s);
  if (requireMovementMarker) assert.equal(s.movementDeclarationRuling, "first-step", "movement marker must survive combat/export");
  assert.deepEqual(JSON.parse(E.exportSave(s)).state, s, "fixture export must preserve all pending state");
  const restored = JSON.parse(JSON.stringify(s));
  E.assertState(restored);
  out.checks.serializedCheckpoints++;
  return restored;
}

function dispatch(s, command) {
  const original = JSON.stringify(s);
  const next = E.dispatch(s, command);
  assert.equal(JSON.stringify(s), original, "reducer must not mutate input");
  assert.equal(next.commands.length, s.commands.length + 1);
  assert.deepEqual(next.commands.at(-1), command);
  out.checks.dispatches++;
  return checkpoint(next);
}

// Arrange a valid total-card inventory, using the same card transfer rules as
// the focused combat fixtures. This is deliberately not a natural game route.
function setHand(s, kinds) {
  const hunter = E.hunter(s);
  hunter.deck = [...hunter.hand, ...hunter.deck];
  hunter.hand = [];
  for (const kind of kinds) {
    const index = hunter.deck.findIndex(card => card.kind === kind);
    if (index >= 0) hunter.hand.push(...hunter.deck.splice(index, 1));
    else {
      const replaced = hunter.deck.shift();
      s.removedCards.push(replaced.kind);
      const upgrade = s.upgradeDeck.indexOf(kind);
      if (upgrade >= 0) s.upgradeDeck.splice(upgrade, 1);
      else {
        const market = s.market.indexOf(kind);
        assert(market >= 0);
        s.market[market] = s.upgradeDeck.shift() || null;
      }
      hunter.hand.push({ id: "card-" + (++s.uid), kind });
    }
  }
}

function putBossActionFirst(s, actionId) {
  const enemy = s.enemies[0];
  const deck = enemy.bossDecks[enemy.componentPhase - 1];
  const cards = [...deck.draw, ...deck.discard];
  const index = cards.indexOf(actionId);
  assert(index >= 0);
  cards.splice(index, 1);
  deck.draw = [actionId, ...cards];
  deck.discard = [];
}

function fixture(weaponId, face, phase, action, kind, variant) {
  let s = E.create(4, weaponId, face, null, E.data.weapons[weaponId].defaultFirearm || "hunter-pistol",
    "center", { campaign: false, rulesVersion: 14 });
  s = adoptPolicies(s, weaponId);
  const definition = B.definition("cleric-beast", phase);
  s.enemies = [{
    id: "mission-matrix", missionId: "matrix", componentId: "cleric-beast",
    componentSpec: "cleric-beast", componentPhase: phase, kind: "scourge-beast",
    figure: 1, node: E.hunter(s).position, hp: definition.maxHp,
    actualComponent: true, insightTokens: 0,
    bossDecks: B.createDecks("cleric-beast", s, (_, cards) => cards),
  }];
  s.loot = [];
  setHand(s, [kind, "endurance", "endurance"]);
  putBossActionFirst(s, action);
  const hunter = E.hunter(s);
  if (variant === "active") {
    if (weaponId === "tonitrus") hunter.weaponCharge = { round: s.round, speed: 1, damage: 1 };
    if (weaponId === "rifle-spear") hunter.moveActionsRound = 2;
    if (weaponId === "beast-claw") hunter.hp = 3;
  }
  return checkpoint(s);
}

// Independent arithmetic for printed slots, stat effects and weapon bonuses.
// This never calls the engine's attack calculation to predict its result.
function prediction(s, slotIndex, kind, boost) {
  const face = E.weaponFace(s), parameters = face.effect?.parameters || {};
  const code = face.effect?.code, slot = face.slots[slotIndex], hunter = E.hunter(s);
  let speed = slot.speed, damage = slot.damage + (kind === "strength" ? 1 : 0), selfDamage = 0;
  if (code === "attack_sacrifice_damage") { selfDamage = boost || 0; damage += selfDamage; }
  if (code === "attack_sacrifice_speed_or_damage" && boost !== undefined) {
    selfDamage = 1;
    if (boost === "speed") speed++;
    if (boost === "damage") damage++;
  }
  if (code === "stagger_attack_damage_one" && kind === "skill") damage++;
  if (code === "damage_per_move_action_this_round") damage += hunter.moveActionsRound || 0;
  if (code === "finishing_combo_damage_per_filled_slot" && slotIndex === parameters.slot && kind !== "endurance") damage++;
  if (code === "low_health_speed_damage" && hunter.hp <= 3) { speed++; damage++; }
  if (code === "transform_next_attack_speed_damage_one" && hunter.weaponCharge) { speed++; damage++; }
  const destructive = code === "destructive_attack_no_interrupt_or_dodge" && slotIndex === parameters.slot;
  return {
    speed, damage, selfDamage,
    hp: Math.min(6, hunter.hp - selfDamage + (code === "attack_heal" ? 1 : 0)),
    interrupt: kind === "skill", interruptEqual: code === "stagger_equal_speed",
    immuneInterrupt: destructive, noDodge: destructive,
    preDamage: kind === "endurance" && code === "clear_slot_damage_one_same_space" ? 1 : 0,
    code,
  };
}

function mandatoryChoice(s) {
  const hunter = E.hunter(s);
  switch (s.phase) {
    case "weapon_choice": {
      const choices = E.weaponChoices(s);
      const choice = choices.find(option => option.command.stop) || choices.find(option => !option.disabled);
      assert(choice, "mandatory weapon choice must have legal response");
      return choice.command;
    }
    case "free_transform": return { type: "FREE_TRANSFORM", accept: false };
    case "stun": return { type: "STUN_DISCARD", cardId: hunter.hand[0]?.id };
    case "boss_move": {
      const nodes = E.bossMoveOptions(s);
      assert(nodes.length > 1, "boss move must present legal destinations");
      return { type: "BOSS_STEP", node: nodes[0] };
    }
    case "combat_react": case "boss_react": return { type: "RESOLVE" };
    case "combat_choose": return { type: "NO_ATTACK" };
    case "kill_react": return { type: "KILL_CONTINUE" };
    case "card_choice": {
      const choice = s.cardChoices[0];
      const value = choice.type === "discard" ? hunter.hand[0]?.id
        : choice.type === "status" ? Object.keys(hunter.status).find(key => hunter.status[key])
          : hunter.slots.findIndex(Boolean);
      return { type: "CARD_CHOICE", value };
    }
    default: throw new Error("Unhandled continuation phase " + s.phase);
  }
}

const finishedPhases = ["hunter", "refill", "upgrade_pick", "return", "over"];
function settle(s, mode, trace) {
  for (let step = 0; step < 40; step++) {
    if (finishedPhases.includes(s.phase)) return s;
    if (s.phase === "boss_react") {
      assert.equal(s.combat.immediate.name, "뛰어 내려찍기");
      assert.equal(s.combat.immediate.damage, 2);
      assert.equal(s.combat.immediate.dodgeSpeed, 1);
      trace.immediate++;
    }
    if (s.phase === "combat_react" && s.combat.action.id === "slam" && trace.immediate) trace.followup = true;
    const hunter = E.hunter(s);
    const dodge = mode === "dodge" && ["combat_react", "boss_react"].includes(s.phase)
      && hunter.hand.flatMap(card => E.slots(s).map((_, slot) => ({ cardId: card.id, slot })))
        .find(option => E.canDodge(s, option.cardId, option.slot));
    if (dodge) {
      s = dispatch(s, { type: "DODGE", ...dodge });
      out.checks.legalDodges++;
      mode = "resolve";
      continue;
    }
    s = dispatch(s, mandatoryChoice(s));
  }
  throw new Error("Continuation loop limit");
}

function runScenario(key, weapon, action) {
  const { weapon: weaponId, face, slot, kind, variant, mode } = key;
  const boost = key.boost === null ? undefined : key.boost;
  let s = fixture(weaponId, face, action.phase, action.id, kind, variant);
  const expected = prediction(s, slot, kind, boost), hunter = E.hunter(s);
  const cardId = hunter.hand[0].id, handCount = hunter.hand.length, bossHp = s.enemies[0].hp;
  s = dispatch(s, {
    type: "ATTACK", enemyId: s.enemies[0].id, cardId, slot,
    ...(boost === undefined ? {} : { weaponBoost: boost }),
  });
  const declaration = s.events.findLast(event => event.text.startsWith(E.card({ kind }).name + " → "));
  assert(declaration, "attack declaration must be logged");
  assert.match(declaration.text, new RegExp("속도 " + expected.speed + ", 피해 " + expected.damage + "\\)"));

  if (action.id !== "recovery") {
    assert.equal(E.hunter(s).hand.length, handCount - 1 + (kind === "vitality" ? 1 : 0));
    assert.equal(E.hunter(s).hp, expected.hp);
    assert.equal(E.hunter(s).slots[slot]?.id, kind === "endurance" ? undefined : cardId);
    assert.equal(s.combat.attack.speed, expected.speed);
    assert.equal(s.combat.attack.damage, expected.damage);
    assert.equal(!!s.combat.attack.interrupt, expected.interrupt);
    assert.equal(!!s.combat.attack.interruptEqual, expected.interruptEqual);
    assert.equal(!!s.combat.noDodge, expected.noDodge);
    assert.equal(s.combat.immune.includes("interrupt"), expected.immuneInterrupt);
    if (weaponId === "tonitrus" && variant === "active") assert.equal(E.hunter(s).weaponCharge, undefined);
  }

  let dodged = false, dodgeDamage = 0;
  const trace = { immediate: 0, followup: false };
  if (action.action.type === "attack") {
    const boss = action.action;
    assert.equal(s.combat.action.speed, boss.speed);
    assert.equal(s.combat.action.damage, boss.damage);
    for (const flag of ["stun", "interrupt", "undodgeable", "uninterruptible", "forceHunterMove", "afterAttackMove"]) {
      assert.equal(!!s.combat.action[flag], !!boss[flag]);
    }
    assert.equal(!!E.canBossInsight(s), !!boss.bossInsight);
    out.checks.bossInsightOffers++;

    for (const card of E.hunter(s).hand) {
      for (let index = 0; index < E.slots(s).length; index++) {
        const eligible = E.card(card).dodge === true && !E.hunter(s).slots[index]
          && !expected.noDodge && !boss.undodgeable
          && E.slots(s)[index].speed + (E.card(card).speed || 0) >= boss.speed;
        assert.equal(E.canDodge(s, card.id, index), eligible, "dodge eligibility must match printed speed, flags and cost");
      }
    }
    if (mode === "dodge") {
      const option = E.hunter(s).hand.flatMap(card =>
        E.slots(s).map((_, index) => ({ cardId: card.id, slot: index })))
        .find(candidate => E.canDodge(s, candidate.cardId, candidate.slot));
      if (option) {
        const speed = E.slots(s)[option.slot].speed;
        s = dispatch(s, { type: "DODGE", ...option });
        dodged = true;
        out.checks.legalDodges++;
        if (["dodge_damage_all_within_one", "dodge_heal_damage_one_same_space"].includes(expected.code)) dodgeDamage = 1;
        if (expected.code === "dodge_matching_speed_damage" && speed === boss.speed) dodgeDamage = 2;
        if (["ludwigs-holy-blade", "uncanny-ludwigs-holy-blade", "kirkhammer"].includes(weaponId)
          && expected.code === "clear_slot_damage_one_same_space") dodgeDamage++;
      } else {
        const card = E.hunter(s).hand.find(candidate => E.card(candidate).dodge);
        if (card) {
          const snapshot = structuredClone(s);
          assert.throws(() => E.dispatch(s, { type: "DODGE", cardId: card.id, slot }));
          assert.deepEqual(s, snapshot, "illegal dodge must leave its input intact");
          out.checks.illegalDodgeAtomicity++;
        }
      }
    }

    const enemyCanceled = dodged || expected.interrupt
      && (expected.speed > boss.speed || expected.interruptEqual && expected.speed === boss.speed)
      && !boss.uninterruptible;
    const incoming = enemyCanceled ? 0 : boss.damage;
    const attackCanceled = !enemyCanceled && boss.interrupt && boss.speed > expected.speed && !expected.immuneInterrupt;
    const deadBeforeAttack = !enemyCanceled && boss.speed > expected.speed && incoming >= expected.hp;
    const movedBeforeAttack = !enemyCanceled && boss.speed > expected.speed && (boss.afterAttackMove || boss.forceHunterMove);
    const expectedDirect = attackCanceled || deadBeforeAttack || movedBeforeAttack
      ? null : expected.damage + (dodged && boss.afterDodgeDamageBonus ? 1 : 0);
    s = settle(s, "resolve", trace);

    const damageLine = s.events.findLast(event => event.text.startsWith(weapon.faces[face].slots[slot].name + " · 적에게 "));
    const incomingLines = s.events.filter(event => event.text.startsWith(boss.name + " · 사냥꾼에게 "));
    if (expectedDirect === null) {
      assert.equal(damageLine, undefined, "faster interruption, lethal damage or displacement must cancel the later hit");
    } else {
      assert.equal(damageLine?.text, weapon.faces[face].slots[slot].name + " · 적에게 " + expectedDirect + " 피해.");
    }
    assert.equal(incomingLines.length, incoming ? 1 : 0);
    if (incoming) assert.equal(incomingLines[0].text, boss.name + " · 사냥꾼에게 " + incoming + " 피해.");
    const survivor = s.enemies.find(enemy => enemy.id === "mission-matrix");
    assert(survivor, "full-health boss must survive this bounded attack");
    assert.equal(survivor.hp, bossHp - expected.preDamage - dodgeDamage - (expectedDirect || 0));
    out.checks.scalarOutcomes++;
  } else if (action.id === "recovery") {
    s = settle(s, "resolve", trace);
    assert.equal(s.enemies[0].hp, bossHp - expected.preDamage - Math.max(0, expected.damage - 2));
    assert.equal(E.hunter(s).hp, expected.hp);
    assert.equal(s.enemies[0].insightTokens, 0);
    assert.equal(s.enemies[0].bossDecks[action.phase - 1].draw.length, 5);
    assert.equal(s.enemies[0].bossDecks[action.phase - 1].discard.length, 0);
    out.checks.scalarOutcomes++;
  } else {
    assert.equal(s.phase, "boss_react");
    s = settle(s, mode, trace);
    assert(trace.immediate > 0);
    assert(trace.followup, "leap must reveal the next boss action after its own reaction");
    assert(s.events.some(event => event.text.includes("내려찍기")));
    out.checks.leapFollowups++;
  }
  assert(finishedPhases.includes(s.phase));
  assert.equal(s.combat, null, "continuation must finish the combat");
  assert.equal(E.hunter(s).slots.length, E.slots(s).length);
}

for (const [weaponId, weapon] of weapons) {
  for (const face of [0, 1]) {
    for (const action of actions) {
      const row = { weapon: weaponId, face, boss: "cleric-beast", phase: action.phase, action: action.id, total: 0, pass: 0, fail: 0 };
      const effect = weapon.faces[face].effect?.code;
      const boosts = effect === "attack_sacrifice_damage" ? [null, 1, 2]
        : effect === "attack_sacrifice_speed_or_damage" ? [null, "speed", "damage"] : [null];
      const variants = ["normal", ...(["tonitrus", "rifle-spear", "beast-claw"].includes(weaponId) ? ["active"] : [])];
      for (let slot = 0; slot < weapon.faces[face].slots.length; slot++) {
        for (const kind of ["strength", "skill", "endurance", "vitality"]) {
          for (const boost of boosts) {
            for (const variant of variants) {
              for (const mode of ["resolve", "dodge"]) {
                row.total++;
                const key = { weapon: weaponId, face, boss: "cleric-beast", phase: action.phase, action: action.id, slot, kind, boost, variant, mode };
                try {
                  runScenario(key, weapon, action);
                  row.pass++;
                } catch (error) {
                  row.fail++;
                  out.failures.push({ case: key, error: error.message, stack: error.stack.split("\n").slice(0, 5) });
                }
              }
            }
          }
        }
      }
      out.rows.push(row);
    }
  }
}

out.final = { source: sourceFingerprint(), fileTimes: sourceFileTimes() };
out.sourcesUnchanged = loadedMatchesDisk && JSON.stringify(initialSources) === JSON.stringify(out.final.source);
out.scenarios = out.rows.reduce((sum, row) => sum + row.total, 0);
out.pass = out.rows.reduce((sum, row) => sum + row.pass, 0);
out.fail = out.failures.length;
out.basePass = out.rows.filter(row => row.fail === 0).length;
out.baseFail = out.rows.length - out.basePass;
out.scopeMatches = out.baseCombinations === 270 && out.scenarios === 8280;
out.observedUtc = new Date().toISOString();
fs.mkdirSync(options.outputRoot, { recursive: true });
fs.writeFileSync(path.join(options.outputRoot, "inventory.json"), JSON.stringify(out.inventory, null, 2) + "\n");
fs.writeFileSync(path.join(options.outputRoot, "matrix-results.json"), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({
  inputRoot: options.inputRoot, outputRoot: options.outputRoot, policy: out.policy,
  adoptedPolicies: out.adoptedPolicies, loadedMatchesDisk: out.loadedMatchesDisk,
  sourcesUnchanged: out.sourcesUnchanged, baseCombinations: out.baseCombinations,
  basePass: out.basePass, baseFail: out.baseFail, scenarios: out.scenarios,
  pass: out.pass, fail: out.fail, scopeMatches: out.scopeMatches,
  checks: out.checks, firstFailures: out.failures.slice(0, 12),
}, null, 2));
process.exitCode = out.fail || !out.sourcesUnchanged || !out.scopeMatches ? 1 : 0;
