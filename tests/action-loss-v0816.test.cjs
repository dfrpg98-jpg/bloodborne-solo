"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), Loss = require("../src/hunt-action-loss"), Departure = require("../src/hunt-departure");
const H = E.hunter, copy = structuredClone, cache = new Map();
const clinicTrace = "v074-clinic-escort-chapter-two-natural-commands.json";
function strict(state) {
  const saved = E.exportSave(state);
  assert.equal(E.exportSave(E.importSave(saved)), saved, "public command checkpoints retain exact strict save replay");
  return state;
}
function run(state, ...commands) { return commands.reduce((s, command) => E.dispatch(s, command), state); }
function natural(file, count, { weapon = "burial", face = 1, consumables = [] } = {}) {
  const key = JSON.stringify([file, count, weapon, face, consumables]);
  if (!cache.has(key)) {
    let s = E.create(90, weapon, face, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13,
      qa: { preset: "custom", startRewards: [], startConsumables: consumables } });
    for (const command of require("./fixtures/" + file).slice(0, count)) s = E.dispatch(s, command);
    cache.set(key, strict(s));
  }
  return copy(cache.get(key));
}
function house() {
  if (!cache.has("house")) {
    let s = E.create(14, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14,
      qa: { preset: "custom", startRewards: ["lantern"], startConsumables: ["bold-mark"] } });
    s = run(s, { type: "MOVE", cardId: H(s).hand[0].id }, { type: "EXPLORE", edge: "N" },
      { type: "PLACE_TILE", rotation: 1 }, { type: "STEP", node: "tile-11:house" });
    assert.equal(H(s).position, "tile-11:house"); assert(s.mission.revealed.includes(8));
    cache.set("house", strict(s));
  }
  return copy(cache.get("house"));
}
function checkpoint(place, status) {
  const key = place + "/" + status;
  if (!cache.has(key)) {
    let s;
    if (place === "house") {
      s = house();
      if (status !== "ground") {
        s = run(s, { type: "MOVE", cardId: H(s).hand[0].id }, { type: "MISSION_PICKUP" });
        if (status === "carried") s = E.dispatch(s, { type: "STEP", node: "tile-11:street" });
        s = E.dispatch(s, { type: "STOP_MOVE" });
      }
    } else {
      s = natural(clinicTrace, status === "carried" ? 133 : status === "armed" ? 132 : 131,
        { consumables: ["bold-mark"] });
      if (status !== "carried") s = E.dispatch(s, { type: "STOP_MOVE" });
    }
    assert.equal(s.phase, "hunter"); assert.equal(s.mission.escort.pickup, status === "armed");
    assert.equal(s.mission.escort.carrierId, status === "carried" ? s.activeHunterId : null);
    cache.set(key, strict(s));
  }
  return copy(cache.get(key));
}
function departure(s, kind) {
  const destination = s.mission.chapter === 1 ? "tile-14:center" : "tile-20:room";
  if (kind === "dream") return { type: "DREAM", cardId: H(s).hand[0].id };
  if (kind === "lantern") return { type: "USE_REWARD", rewardId: H(s).rewards.find(r => r.kind === "lantern").id, node: destination };
  return { type: "USE_CONSUMABLE", itemId: H(s).consumables.find(item => item.kind === "bold-mark").id, node: destination };
}
function planned(s, commands) {
  const saved = E.exportSave(s), request = copy(commands), result = Loss.plan(E, s, commands);
  assert.equal(E.exportSave(s), saved, "inspecting or declining a proposed action spends no card, tool, item, token or RNG");
  assert.deepEqual(commands, request, "the original command batch is never rewritten by a loss notice");
  return result;
}

// These are synthetic QA checkpoints generated entirely by public commands.
// They verify the warning contracts and unchanged movement rules, not a newly
// completed normal campaign or a native-browser playthrough.
for (const place of ["house", "bridge"]) {
  for (const status of ["ground", "armed", "carried"]) {
    for (const kind of ["dream", "lantern", "bold-mark"]) {
      test(`${place} ${status}: ${kind} reports the actual escort outcome before any resource is spent`, () => {
        const s = checkpoint(place, status), command = departure(s, kind), before = E.exportSave(s), result = planned(s, [command]);
        assert(result); assert.equal(result.sourceRevision, s.revision); assert.deepEqual(result.commands, [command]);
        const escorts = result.losses.filter(loss => loss.id === "escort"); assert.equal(escorts.length, 1);
        const loss = escorts[0], carried = status === "carried";
        assert.equal(loss.count, 1); assert.equal(loss.commandIndex, 0); assert.equal(loss.ruleCard, place === "house" ? 8 : 37);
        assert.equal(loss.effect, carried ? "return" : "stay");
        assert.equal(loss.destinationNode, carried ? place === "house" ? "tile-11:house" : "tile-18:top" : H(s).position);
        if (carried) assert.match(loss.summary, /생존자 원위치 복귀/);
        else {
          assert.equal(loss.summary, "생존자 함께 이동 불가 · 현재 칸에 남음");
          assert.match(loss.description, /함께/); assert.match(loss.description, /남/);
          assert.doesNotMatch(loss.description, /버립|사라|잃습니다|돌아갑니다/);
        }
        assert.equal(Departure.plan(E, s, [command]), null, "a teleport confirmation does not also ask to walk with the escort");
        // Declining means no reducer command is executed; accepting commits the
        // original command once. The warning itself is not a gameplay command.
        assert.equal(E.exportSave(s), before);
        const next = strict(E.dispatch(s, command));
        assert.equal(E.exportSave(s), before); assert.equal(next.commands.length, s.commands.length + 1);
        assert.equal(next.mission.escort.carrierId, null); assert.equal(next.mission.escort.pickup, false);
        assert.equal(next.mission.escort.node, loss.destinationNode);
        if (kind === "dream") assert.equal(H(next).inDream, true);
        else assert.equal(H(next).position, command.node);
        if (kind === "lantern") assert.equal(H(next).rewards.find(r => r.id === command.rewardId).ready, false);
        if (kind === "bold-mark") assert(!H(next).consumables.some(item => item.id === command.itemId));
      });
    }
  }
}

test("a hint can precede a destination or cost selection, while actionable confirmation still requires a valid complete command", () => {
  const s = checkpoint("bridge", "ground"), saved = E.exportSave(s), command = departure(s, "lantern"),
    engine = { ...E, dispatch() { throw Error("a passive hint must not dispatch"); } };
  const hint = Loss.preview(engine, s, { type: "USE_REWARD", rewardId: command.rewardId });
  assert(hint); assert.equal(hint.losses[0].effect, "stay"); assert.equal(hint.commands, undefined);
  assert.equal(planned(s, [{ type: "USE_REWARD", rewardId: command.rewardId }]), null);
  assert.equal(planned(s, [{ type: "DREAM" }]), null);
  assert.equal(planned(s, [{ ...command, node: "missing" }]), null);
  assert.equal(planned(s, [command, { type: "STEP", node: "missing" }]), null);
  assert.equal(E.exportSave(s), saved);
});

test("a ground escort in another cell of the same tile produces no stay warning or remote pickup", () => {
  let s = house(); s = run(s, { type: "MOVE", cardId: H(s).hand[0].id },
    { type: "STEP", node: "tile-11:street" }, { type: "STOP_MOVE" }); strict(s);
  assert.equal(s.mission.escort.node, "tile-11:house"); assert.equal(s.mission.escort.carrierId, null);
  for (const kind of ["dream", "lantern", "bold-mark"]) {
    const command = departure(s, kind); assert.equal(planned(s, [command]), null);
    assert.equal(Loss.preview(E, s, command), null);
    const next = strict(E.dispatch(s, command));
    assert.equal(next.mission.escort.node, "tile-11:house"); assert.equal(next.mission.escort.carrierId, null);
  }
});

test("completed bridge escort delivery is not turned into a missing-companion warning", () => {
  const s = natural(clinicTrace, 141, { consumables: ["bold-mark"] });
  assert(s.mission.completed.includes(38)); assert.equal(s.mission.escort.node, null); assert.equal(s.mission.escort.carrierId, null);
  const command = departure(s, "lantern"); assert.equal(planned(s, [command]), null);
  assert.equal(Loss.preview(E, s, command), null); strict(E.dispatch(s, command));
});

test("the paid house-room rescue and the uncaptured experiment do not gain free escort stay warnings", () => {
  const room = natural("weapon-campaign-completion/beast-claw-0.json", 35, { weapon: "beast-claw", face: 0 }),
    experiment = natural("v074-help-iosefka-natural-commands.json", 317);
  for (const s of [room, experiment]) {
    assert.equal(s.mission.survivor.node, H(s).position); assert.equal(s.mission.survivor.carrierId || null, null);
    assert.equal(E.interactionOptions(s).missionRescue, true);
    const command = { type: "DREAM", cardId: H(s).hand[0].id };
    assert.equal(planned(s, [command]), null); assert.equal(Loss.preview(E, s, command), null);
    const next = strict(E.dispatch(s, command)); assert.equal(next.mission.survivor.node, s.mission.survivor.node);
  }
});

test("a nearby salvation NPC with no follow selection does not gain an escort warning", () => {
  const s = natural("v074-optional-58-natural-commands.json", 223, { consumables: ["qa-cards"] });
  assert.equal(s.mission.npc.node, H(s).position); assert.equal(s.mission.npc.follow, false);
  const command = { type: "DREAM", cardId: H(s).hand[0].id };
  assert.equal(planned(s, [command]), null); assert.equal(Loss.preview(E, s, command), null);
  const next = strict(E.dispatch(s, command)); assert.equal(next.mission.npc.node, s.mission.npc.node);
});

test("carried bridge escort departure through the central lamp retains one return warning", () => {
  const s = natural(clinicTrace, 136, { consumables: ["bold-mark"] }),
    command = { type: "INTERACT", cardId: H(s).hand[0].id, lamp: "tile-20:room" }, result = planned(s, [command]);
  assert.equal(H(s).position, "tile-14:center"); assert(result);
  assert.equal(result.losses.filter(loss => loss.id === "escort").length, 1);
  assert.equal(result.losses.find(loss => loss.id === "escort").effect, "return");
  const next = strict(E.dispatch(s, command)); assert.equal(H(next).position, command.lamp);
  assert.equal(next.mission.escort.node, "tile-18:top"); assert.equal(next.mission.escort.carrierId, null);
});

test("walking retains its free departure question without a transport warning or a second question for carried survivors", () => {
  let s = house(); s = E.dispatch(s, { type: "MOVE", cardId: H(s).hand[0].id });
  const command = { type: "STEP", node: "tile-11:street" }, result = Departure.plan(E, s, [command]);
  assert(result); assert.equal(planned(s, [command]), null);
  const yes = strict(run(s, ...result.acceptCommands)), no = strict(run(s, ...result.declineCommands));
  assert.equal(yes.mission.escort.carrierId, yes.activeHunterId);
  assert.equal(no.mission.escort.node, "tile-11:house"); assert.equal(no.mission.escort.carrierId, null);
  const back = { type: "STEP", node: "tile-11:house" };
  assert.equal(Departure.plan(E, yes, [back]), null); assert.equal(planned(yes, [back]), null);
  assert.equal(strict(E.dispatch(yes, back)).mission.escort.carrierId, yes.activeHunterId);
});

test("Dream entry resets a pickup reservation and RETURN neither picks up remotely nor repeats its warning", () => {
  let s = checkpoint("house", "armed"), command = departure(s, "dream");
  assert.equal(planned(s, [command]).losses[0].effect, "stay");
  s = run(s, command, { type: "REFILL" }); strict(s);
  assert.equal(s.phase, "return"); assert.equal(s.mission.escort.pickup, false);
  command = { type: "RETURN", node: "tile-14:center", face: H(s).face };
  assert.equal(planned(s, [command]), null); assert.equal(Loss.preview(E, s, command), null);
  assert.equal(Departure.plan(E, s, [command]), null);
  const next = strict(E.dispatch(s, command)); assert.equal(next.mission.escort.node, "tile-11:house");
  assert.equal(next.mission.escort.carrierId, null); assert.equal(H(next).position, command.node);
});

test("an unchanged destination cannot produce a false ground stay confirmation", () => {
  const s = house(), command = { ...departure(s, "lantern"), node: H(s).position };
  assert.equal(planned(s, [command]), null, "the real lantern rejects this non-lamp destination");
  // Free escort home cells are not lamps, so this target-equality predicate is
  // also isolated with a no-op reducer adapter. No game state is mutated and
  // this adapter contract is not claimed as a legal lantern playthrough.
  const adapter = { ...E, dispatch(before) { return copy(before); } }, saved = E.exportSave(s);
  assert.equal(Loss.plan(adapter, s, [command]), null);
  assert.equal(E.exportSave(s), saved);
});
