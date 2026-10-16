"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const E = require("../src/hunt-engine"), P = require("../src/hunt-attack-preview"),
  { boot } = require("./helpers/ui-harness.cjs"), { fixture, bossAction } = require("./actual-combat-helper.cjs");
const H = E.hunter, key = "bloodborne-hunt-v07", sha = value => crypto.createHash("sha256").update(value).digest("hex");
// Only game setup and accepted public commands were extracted from the supplied
// dev.17 normal campaign save (source hash below). No source save, personal
// paths or component image metadata are embedded. This replays that historical
// input in the current engine; it is not a new campaign played for this test.
const actualReplay = {
  "originalSourceSha256": "0c655a1a0698c997f66398e794c392fff65bcf6a66316c4ebee686637b2d57d6",
  "seed": 1079899198,
  "setup": {
    "weaponId": "rifle-spear",
    "face": 0,
    "startingConsumable": null,
    "firearmId": "hunter-pistol",
    "startSpace": "center",
    "rulesVersion": 14,
    "campaign": true
  },
  "attack": {
    "type": "ATTACK",
    "enemyId": "mission-main",
    "cardId": "card-18",
    "slot": 0,
    "itemIds": [
      "item-numbing-mist-1"
    ],
    "pullIds": [],
    "rewardIds": [
      "reward-28"
    ]
  },
  "nextCommand": {
    "type": "FREE_TRANSFORM",
    "accept": true
  },
  "expectedBeforeSha256": "ebaa641853d3537fca8f0562ffee1dafc1e24a756fb0245b992ba2d2d8ed6b9e",
  "expectedAfterSha256": "28719570e574770ca761e2b330196a12923d9d1a0edfcea1183eb65472bdc4a4",
  "expectedNextSha256": "248feda98225e6d45f9b9936c8a03db0b2e7ee02920d5e94c336627fb3a6df76"
,
  "beforeCommands": [
    {"type":"APPLY_TILE_SPEED_RULING"},
    {"type":"MOVE","cardId":"card-7"},
    {"type":"EXPLORE","edge":"N"},
    {"type":"PLACE_TILE","rotation":0},
    {"type":"STEP","node":"tile-14:center"},
    {"type":"MOVE","cardId":"card-9"},
    {"type":"STEP","node":"tile-14:left"},
    {"type":"EXPLORE","edge":"W"},
    {"type":"PLACE_TILE","rotation":0},
    {"type":"ATTACK","cardId":"card-11","slot":0,"itemIds":[],"pullIds":[],"rewardIds":[],"enemyId":"huntsmans-minion-1"},
    {"type":"FIREARM"},
    {"type":"RESOLVE"},
    {"type":"END_TURN"},
    {"type":"NO_ATTACK"},
    {"type":"RESOLVE"},
    {"type":"REFILL","discardIds":[]},
    {"type":"MOVE","cardId":"card-3"},
    {"type":"STEP","node":"tile-14:left"},
    {"type":"STEP","node":"tile-14:center"},
    {"type":"END_TURN"},
    {"type":"ENTRY_WEAPON","accept":true,"cardId":"card-8","slot":1},
    {"type":"COUNTER","cardId":"card-2","slot":2,"itemIds":[],"pullIds":[],"rewardIds":[]},
    {"type":"RESOLVE"},
    {"type":"REFILL","discardIds":[]},
    {"type":"DREAM","cardId":"card-6"},
    {"type":"REFILL","discardIds":[]},
    {"type":"RETURN","node":"tile-14:center","face":1,"reassignAttachments":true},
    {"type":"MOVE","cardId":"card-3"},
    {"type":"STEP","node":"tile-14:left"},
    {"type":"STEP","node":"tile-11:street"},
    {"type":"ATTACK","cardId":"card-11","slot":2,"itemIds":[],"pullIds":[],"rewardIds":[],"enemyId":"huntsmans-minion-1"},
    {"type":"RESOLVE"},
    {"type":"ENEMY_STEP","node":"tile-14:left"},
    {"type":"STUN_DISCARD","cardId":"card-1"},
    {"type":"ATTACK","cardId":"card-12","slot":0,"itemIds":[],"pullIds":[],"rewardIds":[],"enemyId":"huntsmans-minion-1"},
    {"type":"RESOLVE"},
    {"type":"MOVE","cardId":"card-5"},
    {"type":"EXPLORE","edge":"S"},
    {"type":"PLACE_TILE","rotation":1},
    {"type":"STEP","node":"tile-05:bottom"},
    {"type":"END_TURN"},
    {"type":"NO_ATTACK"},
    {"type":"FIREARM"},
    {"type":"RESOLVE"},
    {"type":"NO_ATTACK"},
    {"type":"RESOLVE"},
    {"type":"REFILL","discardIds":[]},
    {"type":"RETURN","node":"tile-14:center","face":1},
    {"type":"MOVE","cardId":"card-5"},
    {"type":"STEP","node":"tile-14:right"},
    {"type":"EXPLORE","edge":"E"},
    {"type":"PLACE_TILE","rotation":0},
    {"type":"END_TURN"},
    {"type":"COUNTER","cardId":"card-9","slot":0,"itemIds":[],"pullIds":[],"rewardIds":[]},
    {"type":"FIREARM"},
    {"type":"RESOLVE"},
    {"type":"REFILL","discardIds":[]},
    {"type":"ATTACK","enemyId":"huntsman-mob-1","cardId":"card-8","slot":2,"itemIds":[],"pullIds":[],"rewardIds":[]},
    {"type":"DODGE","cardId":"card-3","slot":1},
    {"type":"RESOLVE"},
    {"type":"KEEP_FIREARM","firearmId":"ludwig-rifle"},
    {"type":"MOVE","cardId":"card-6"},
    {"type":"STEP","node":"tile-04:center"},
    {"type":"EXPLORE","edge":"S"},
    {"type":"PLACE_TILE","rotation":2},
    {"type":"END_TURN"},
    {"type":"NO_ATTACK"},
    {"type":"RESOLVE"},
    {"type":"NO_ATTACK"},
    {"type":"RESOLVE"},
    {"type":"REFILL","discardIds":[]},
    {"type":"DREAM","cardId":"card-4"},
    {"type":"PICK_UPGRADE","index":1},
    {"type":"REPLACE_UPGRADE","replaceId":"card-7"},
    {"type":"REFILL","discardIds":[]},
    {"type":"RETURN","node":"tile-04:center","face":1},
    {"type":"MOVE","cardId":"card-12"},
    {"type":"STEP","node":"tile-03:entry"},
    {"type":"STEP","node":"tile-03:room"},
    {"type":"ATTACK","enemyId":"scourge-beast-1","cardId":"card-9","slot":0,"itemIds":[],"pullIds":[],"rewardIds":[]},
    {"type":"FIREARM"},
    {"type":"RESOLVE"},
    {"type":"INTERACT","cardId":"card-3","lootCount":2,"heal":false,"lamp":null,"mission":"rescue"},
    {"type":"RESOLVE"},
    {"type":"MISSION_SURVIVOR_STEP","node":"tile-03:entry"},
    {"type":"MISSION_SURVIVOR_STEP","node":"tile-04:center"},
    {"type":"MISSION_SURVIVOR_STEP","node":"tile-04:left"},
    {"type":"MISSION_SURVIVOR_STEP","node":"tile-14:right"},
    {"type":"USE_CONSUMABLE","itemId":"item-pebble-2","enemyId":"huntsmans-minion-1","node":"tile-04:center"},
    {"type":"END_TURN"},
    {"type":"MISSION_SURVIVOR_STEP","node":"tile-14:center"},
    {"type":"REFILL","discardIds":[]},
    {"type":"MOVE","cardId":"card-2"},
    {"type":"STEP","node":"tile-03:entry"},
    {"type":"STEP","node":"tile-04:center"},
    {"type":"MOVE","cardId":"card-1"},
    {"type":"STEP","node":"tile-04:left"},
    {"type":"STEP","node":"tile-14:right"},
    {"type":"MOVE","cardId":"card-4"},
    {"type":"STEP","node":"tile-14:center"},
    {"type":"STOP_MOVE"},
    {"type":"MISSION_CHOICE","choice":"release"},
    {"type":"END_TURN"},
    {"type":"ACTIVATE","enemyId":"huntsmans-minion-2"},
    {"type":"NO_ATTACK"},
    {"type":"RESOLVE"},
    {"type":"ENEMY_STEP","node":"tile-05:upper-left"},
    {"type":"ENEMY_STEP","node":"tile-05:upper-right"},
    {"type":"REFILL","discardIds":[]},
    {"type":"RETURN","node":"tile-14:center","face":1},
    {"type":"MOVE","cardId":"card-6"},
    {"type":"STEP","node":"tile-14:left"},
    {"type":"STOP_MOVE"},
    {"type":"MOVE","cardId":"card-12"},
    {"type":"STEP","node":"tile-14:center"},
    {"type":"STOP_MOVE"},
    {"type":"ATTACK","enemyId":"scourge-beast-3","cardId":"card-10","slot":0,"itemIds":[],"pullIds":[],"rewardIds":[]},
    {"type":"FIREARM"},
    {"type":"RESOLVE"},
    {"type":"ATTACK","enemyId":"scourge-beast-3","cardId":"card-9","slot":1,"itemIds":[],"pullIds":[],"rewardIds":[]},
    {"type":"RESOLVE"},
    {"type":"EQUIP_REWARD","rewardId":"reward-16","slot":0},
    {"type":"PICK_UPGRADE","index":0},
    {"type":"REPLACE_UPGRADE","replaceId":"card-8"},
    {"type":"ENTER_BETWEEN_CHAPTERS"},
    {"type":"START_NEXT_CHAPTER","startSpace":"center","face":1},
    {"type":"MOVE","cardId":"card-9"},
    {"type":"STEP","node":"tile-13:bottom"},
    {"type":"STEP","node":"tile-13:middle"},
    {"type":"ATTACK","enemyId":"scourge-beast-1","cardId":"card-10","slot":0,"itemIds":[],"pullIds":[],"rewardIds":[]},
    {"type":"DODGE","cardId":"card-2","slot":1},
    {"type":"RESOLVE"},
    {"type":"EXTRA_TAKE"},
    {"type":"MISSION_CORPSES","count":1},
    {"type":"INTERACT","cardId":"card-5","lootCount":1,"heal":false,"lamp":null},
    {"type":"END_TURN"},
    {"type":"REFILL","discardIds":[]},
    {"type":"MOVE","cardId":"card-6"},
    {"type":"STEP","node":"tile-13:top"},
    {"type":"STEP","node":"tile-13:middle"},
    {"type":"MISSION_LURE","itemId":"item-bolt-paper-2"},
    {"type":"ATTACK","enemyId":"scourge-beast-1","cardId":"card-18","slot":1,"itemIds":[],"pullIds":[],"rewardIds":[]},
    {"type":"RESOLVE"},
    {"type":"EXTRA_TAKE"},
    {"type":"MISSION_CORPSES","count":1},
    {"type":"DREAM","cardId":"card-14"},
    {"type":"PICK_UPGRADE","index":1},
    {"type":"PICK_UPGRADE","index":3},
    {"type":"REPLACE_UPGRADE","replaceId":"card-9"},
    {"type":"REPLACE_UPGRADE","replaceId":"card-4"},
    {"type":"REFILL","discardIds":[]},
    {"type":"RETURN","node":"tile-14:center","face":0,"reassignAttachments":true},
    {"type":"MOVE","cardId":"card-5"},
    {"type":"STEP","node":"tile-14:left"},
    {"type":"EXPLORE","edge":"W"},
    {"type":"PLACE_TILE","rotation":0},
    {"type":"MOVE","cardId":"card-12"},
    {"type":"STEP","node":"tile-17:top"},
    {"type":"STOP_MOVE"},
    {"type":"ATTACK","enemyId":"mission-patient","cardId":"card-18","slot":0,"itemIds":[],"pullIds":[],"rewardIds":[]},
    {"type":"FIREARM"},
    {"type":"RESOLVE"},
    {"type":"END_TURN"},
    {"type":"NO_ATTACK"},
    {"type":"REFILL","discardIds":[]},
    {"type":"ATTACK","cardId":"card-19","slot":1,"itemIds":[],"pullIds":[],"rewardIds":[],"enemyId":"mission-patient"},
    {"type":"DODGE","cardId":"card-20","slot":2},
    {"type":"FREE_TRANSFORM","accept":true},
    {"type":"RESOLVE"},
    {"type":"ATTACK","cardId":"card-3","slot":0,"itemIds":[],"pullIds":[],"rewardIds":[],"enemyId":"mission-patient"},
    {"type":"RESOLVE"},
    {"type":"END_TURN"},
    {"type":"NO_ATTACK"},
    {"type":"RESOLVE"},
    {"type":"REFILL","discardIds":[]},
    {"type":"ATTACK","cardId":"card-10","slot":0,"itemIds":[],"pullIds":[],"rewardIds":[],"enemyId":"mission-patient"},
    {"type":"RESOLVE"},
    {"type":"EQUIP_REWARD","rewardId":"reward-21","replaceId":"reward-17"},
    {"type":"MISSION_DEATH_DODGE","cardId":"card-2","slot":2},
    {"type":"MOVE","cardId":"card-6"},
    {"type":"EXPLORE","edge":"N"},
    {"type":"PLACE_TILE","rotation":0},
    {"type":"STEP","node":"tile-20:room"},
    {"type":"MOVE","cardId":"card-14"},
    {"type":"STEP","node":"tile-20:entry"},
    {"type":"STEP","node":"tile-17:top"},
    {"type":"END_TURN"},
    {"type":"REFILL","discardIds":[]},
    {"type":"APPLY_LEAP_MOVE_RULING"},
    {"type":"MOVE","cardId":"card-1"},
    {"type":"STEP","node":"tile-17:lower-left"},
    {"type":"EXPLORE","edge":"W"},
    {"type":"PLACE_TILE","rotation":3},
    {"type":"END_TURN"},
    {"type":"COUNTER","cardId":"card-11","slot":2,"itemIds":[],"pullIds":[],"rewardIds":[]},
    {"type":"DODGE","cardId":"card-20","slot":1},
    {"type":"FREE_TRANSFORM","accept":true},
    {"type":"RESOLVE"},
    {"type":"REFILL","discardIds":[]},
    {"type":"USE_REWARD","rewardId":"reward-15","discardId":"card-6","takeId":"card-20"},
    {"type":"USE_REWARD","rewardId":"reward-21"},
    {"type":"ATTACK","enemyId":"huntsmans-minion-2","cardId":"card-18","slot":0,"itemIds":["item-fire-paper-1"],"pullIds":[],"rewardIds":[]},
    {"type":"DODGE","cardId":"card-20","slot":1},
    {"type":"FREE_TRANSFORM","accept":true},
    {"type":"RESOLVE"},
    {"type":"USE_CONSUMABLE","itemId":"item-molotov-1","enemyId":"huntsmans-minion-2"},
    {"type":"ATTACK","cardId":"card-19","slot":0,"itemIds":[],"pullIds":[],"rewardIds":[],"enemyId":"huntsmans-minion-2"},
    {"type":"RESOLVE"},
    {"type":"MOVE","cardId":"card-3"},
    {"type":"STEP","node":"tile-18:top"},
    {"type":"STOP_MOVE"},
    {"type":"END_TURN"},
    {"type":"REFILL","discardIds":[]},
    {"type":"MOVE","cardId":"card-2"},
    {"type":"STOP_MOVE"},
    {"type":"ATTACK","enemyId":"huntsman-mob-1","cardId":"card-12","slot":2,"itemIds":[],"pullIds":[],"rewardIds":[]},
    {"type":"FIREARM"},
    {"type":"RESOLVE"},
    {"type":"MOVE","cardId":"card-5"},
    {"type":"MISSION_PICKUP"},
    {"type":"STEP","node":"tile-18:bottom"},
    {"type":"STEP","node":"tile-17:lower-left"},
    {"type":"EQUIP_REWARD","rewardId":"reward-22","replaceId":"reward-13"},
    {"type":"EQUIP_FIREARM","firearmId":"repeating-pistol"},
    {"type":"MOVE","cardId":"card-14"},
    {"type":"STEP","node":"tile-17:top"},
    {"type":"STEP","node":"tile-17:lower-right"},
    {"type":"END_TURN"},
    {"type":"REFILL","discardIds":[]},
    {"type":"MOVE","cardId":"card-5"},
    {"type":"STEP","node":"tile-14:left"},
    {"type":"STEP","node":"tile-14:center"},
    {"type":"MOVE","cardId":"card-6"},
    {"type":"STEP","node":"tile-13:bottom"},
    {"type":"STEP","node":"tile-13:middle"},
    {"type":"ATTACK","enemyId":"mission-main","cardId":"card-11","slot":1,"itemIds":[],"pullIds":[],"rewardIds":[]},
    {"type":"TRANSFORM","cardId":"card-18"},
    {"type":"END_TURN"},
    {"type":"NO_ATTACK"},
    {"type":"REFILL","discardIds":[]},
    {"type":"MOVE","cardId":"card-1"},
    {"type":"STEP","node":"tile-13:bottom"},
    {"type":"STOP_MOVE"},
    {"type":"ENTRY_WEAPON","accept":true,"cardId":"card-10","slot":2},
    {"type":"ATTACK","cardId":"card-14","slot":0,"itemIds":[],"pullIds":[],"rewardIds":[],"enemyId":"mission-main"},
    {"type":"BOSS_INSIGHT"},
    {"type":"RESOLVE"},
    {"type":"END_TURN"},
    {"type":"NO_ATTACK"},
    {"type":"USE_REWARD","rewardId":"reward-22"},
    {"type":"RESOLVE"},
    {"type":"REFILL","discardIds":[]},
    {"type":"MOVE","cardId":"card-2"},
    {"type":"STEP","node":"tile-13:middle"},
    {"type":"STOP_MOVE"},
    {"type":"ENTRY_WEAPON","accept":true,"cardId":"card-3","slot":1},
    {"type":"DREAM","cardId":"card-20"},
    {"type":"PICK_UPGRADE","index":1},
    {"type":"PICK_UPGRADE","index":1},
    {"type":"PICK_UPGRADE","index":1},
    {"type":"REPLACE_UPGRADE","replaceId":"card-5"},
    {"type":"REPLACE_UPGRADE","replaceId":"card-6"},
    {"type":"REPLACE_UPGRADE","replaceId":"card-1"},
    {"type":"REFILL","discardIds":[]},
    {"type":"RETURN","node":"tile-14:center","face":1,"reassignAttachments":true},
    {"type":"MOVE","cardId":"card-10"},
    {"type":"STEP","node":"tile-13:bottom"},
    {"type":"STEP","node":"tile-13:middle"},
    {"type":"MOVE","cardId":"card-20"},
    {"type":"STEP","node":"tile-13:bottom"},
    {"type":"STOP_MOVE"},
    {"type":"MOVE","cardId":"card-23"},
    {"type":"STEP","node":"tile-14:center"},
    {"type":"STOP_MOVE"},
    {"type":"END_TURN"},
    {"type":"NO_ATTACK"},
    {"type":"FIREARM"},
    {"type":"RESOLVE"},
    {"type":"ACTIVATE","enemyId":"scourge-beast-1"},
    {"type":"NO_ATTACK"},
    {"type":"RESOLVE"},
    {"type":"NO_ATTACK"},
    {"type":"RESOLVE"},
    {"type":"NO_ATTACK"},
    {"type":"NO_ATTACK"},
    {"type":"USE_REWARD","rewardId":"reward-22"},
    {"type":"RESOLVE"},
    {"type":"REFILL","discardIds":[]},
    {"type":"MOVE","cardId":"card-24"},
    {"type":"STEP","node":"tile-01:top"},
    {"type":"STOP_MOVE"},
    {"type":"MOVE","cardId":"card-12"},
    {"type":"STEP","node":"tile-01:bottom"},
    {"type":"STOP_MOVE"},
    {"type":"MOVE","cardId":"card-25"},
    {"type":"STEP","node":"tile-19:bottom"},
    {"type":"STOP_MOVE"},
    {"type":"KEEP_REWARD","rewardId":"reward-26"},
    {"type":"PICK_UPGRADE","index":0},
    {"type":"REPLACE_UPGRADE","replaceId":"card-2"},
    {"type":"ENTER_BETWEEN_CHAPTERS"},
    {"type":"START_NEXT_CHAPTER","startSpace":"center","face":1},
    {"type":"MOVE","cardId":"card-19"},
    {"type":"STEP","node":"tile-13:bottom"},
    {"type":"STEP","node":"tile-13:middle"},
    {"type":"ATTACK","enemyId":"huntsman-mob-1","cardId":"card-10","slot":0,"itemIds":[],"pullIds":[],"rewardIds":[]},
    {"type":"FIREARM"},
    {"type":"RESOLVE"},
    {"type":"INTERACT","cardId":"card-12","lootCount":1,"heal":false,"lamp":null},
    {"type":"MOVE","cardId":"card-18"},
    {"type":"STEP","node":"tile-13:top"},
    {"type":"EXPLORE","edge":"N"},
    {"type":"PLACE_TILE","rotation":0},
    {"type":"END_TURN"},
    {"type":"REFILL","discardIds":[]},
    {"type":"MOVE","cardId":"card-3"},
    {"type":"STEP","node":"tile-12:middle-left"},
    {"type":"STEP","node":"tile-12:bottom"},
    {"type":"MOVE","cardId":"card-11"},
    {"type":"STEP","node":"tile-13:top"},
    {"type":"STEP","node":"tile-13:middle"},
    {"type":"MOVE","cardId":"card-25"},
    {"type":"STEP","node":"tile-13:top"},
    {"type":"STEP","node":"tile-13:middle"},
    {"type":"END_TURN"},
    {"type":"REFILL","discardIds":[]},
    {"type":"MOVE","cardId":"card-27"},
    {"type":"EXPLORE","edge":"W"},
    {"type":"PLACE_TILE","rotation":3},
    {"type":"STEP","node":"tile-20:room"},
    {"type":"CLINIC"},
    {"type":"MOVE","cardId":"card-24"},
    {"type":"STEP","node":"tile-20:entry"},
    {"type":"STEP","node":"tile-13:middle"},
    {"type":"MOVE","cardId":"card-14"},
    {"type":"EXPLORE","edge":"E"},
    {"type":"PLACE_TILE","rotation":0},
    {"type":"STEP","node":"tile-17:top"},
    {"type":"END_TURN"},
    {"type":"REFILL","discardIds":[]},
    {"type":"TRANSFORM","cardId":"card-12"},
    {"type":"END_TURN"},
    {"type":"REFILL","discardIds":[]},
    {"type":"END_TURN"},
    {"type":"REFILL","discardIds":[]},
    {"type":"END_TURN"},
    {"type":"ENTRY_WEAPON","accept":true,"cardId":"card-24","slot":2},
    {"type":"COUNTER","cardId":"card-23","slot":0,"itemIds":[],"pullIds":[],"rewardIds":[]},
    {"type":"RESOLVE"},
    {"type":"REFILL","discardIds":[]},
    {"type":"MOVE","cardId":"card-27"},
    {"type":"STEP","node":"tile-17:lower-right"},
    {"type":"EXPLORE","edge":"E"},
    {"type":"PLACE_TILE","rotation":1},
    {"type":"MOVE","cardId":"card-20"},
    {"type":"STEP","node":"tile-18:top"},
    {"type":"STOP_MOVE"},
    {"type":"ATTACK","enemyId":"scourge-beast-1","cardId":"card-19","slot":0,"itemIds":[],"pullIds":[],"rewardIds":[]},
    {"type":"RESOLVE"},
    {"type":"INTERACT","cardId":"card-3","lootCount":1,"heal":false,"lamp":null},
    {"type":"END_TURN"},
    {"type":"REFILL","discardIds":[]},
    {"type":"MOVE","cardId":"card-11"},
    {"type":"STEP","node":"tile-18:bottom"},
    {"type":"STEP","node":"tile-17:lower-right"},
    {"type":"MOVE","cardId":"card-25"},
    {"type":"STEP","node":"tile-17:top"},
    {"type":"STOP_MOVE"},
    {"type":"MOVE","cardId":"card-14"},
    {"type":"MISSION_NPC_FOLLOW"},
    {"type":"STEP","node":"tile-17:lower-left"},
    {"type":"STEP","node":"tile-13:middle"},
    {"type":"END_TURN"},
    {"type":"REFILL","discardIds":[]},
    {"type":"TRANSFORM","cardId":"card-18"},
    {"type":"ATTACK","enemyId":"huntsman-mob-1","cardId":"card-14","slot":0,"itemIds":[],"pullIds":[],"rewardIds":[]},
    {"type":"FIREARM"},
    {"type":"RESOLVE"},
    {"type":"EQUIP_REWARD","rewardId":"reward-28","replaceId":"reward-21"},
    {"type":"MOVE","cardId":"card-23"},
    {"type":"STEP","node":"tile-13:bottom"},
    {"type":"STEP","node":"tile-14:center"},
    {"type":"END_TURN"},
    {"type":"NO_ATTACK"},
    {"type":"REFILL","discardIds":[]},
    {"type":"USE_CONSUMABLE","itemId":"item-beast-pellet-2","slot":0},
    {"type":"MOVE","cardId":"card-3"},
    {"type":"STEP","node":"tile-13:bottom"},
    {"type":"STOP_MOVE"},
    {"type":"ATTACK","cardId":"card-10","slot":0,"itemIds":[],"pullIds":[],"rewardIds":["reward-28"],"enemyId":"mission-main"},
    {"type":"DODGE","cardId":"card-20","slot":1},
    {"type":"FREE_TRANSFORM","accept":true},
    {"type":"BOSS_INSIGHT"},
    {"type":"RESOLVE"},
    {"type":"FREE_TRANSFORM","accept":true},
    {"type":"ATTACK","cardId":"card-12","slot":0,"itemIds":[],"pullIds":[],"rewardIds":[],"enemyId":"mission-main"},
    {"type":"BOSS_INSIGHT"},
    {"type":"RESOLVE"},
    {"type":"BOSS_STEP","node":"tile-13:middle"},
    {"type":"USE_REWARD","rewardId":"reward-15","discardId":"card-27","takeId":"card-14"},
    {"type":"ATTACK","cardId":"card-14","slot":1,"itemIds":[],"pullIds":[],"rewardIds":[],"enemyId":"mission-main","leapPath":["tile-13:bottom","tile-13:middle"]},
    {"type":"USE_REWARD","rewardId":"reward-22"},
    {"type":"RESOLVE"},
    {"type":"END_TURN"},
    {"type":"NO_ATTACK"},
    {"type":"RESOLVE"},
    {"type":"NO_ATTACK"},
    {"type":"RESOLVE"},
    {"type":"NO_ATTACK"},
    {"type":"NO_ATTACK"},
    {"type":"RESOLVE"},
    {"type":"REFILL","discardIds":[]},
    {"type":"RETURN","node":"tile-20:room","face":1},
    {"type":"CLINIC"},
    {"type":"MOVE","cardId":"card-23"},
    {"type":"STEP","node":"tile-20:entry"},
    {"type":"STEP","node":"tile-13:middle"}
  ]
};
let cachedBefore;
function beforeAttack() {
  if (!cachedBefore) {
    const c = actualReplay.setup;
    let state = E.create(actualReplay.seed, c.weaponId, c.face, c.startingConsumable, c.firearmId, c.startSpace,
      { campaign: c.campaign, rulesVersion: c.rulesVersion });
    for (const command of actualReplay.beforeCommands) state = E.dispatch(state, command);
    assert.equal(sha(E.exportSave(state)), actualReplay.expectedBeforeSha256); cachedBefore = state;
  }
  return structuredClone(cachedBefore);
}
function afterAttack() { return E.dispatch(beforeAttack(), actualReplay.attack); }
function launch(state, strict = true) {
  const save = strict ? E.exportSave : JSON.stringify, load = strict ? E.importSave : JSON.parse, saved = save(state),
    ui = boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true, storage: { [key]: saved }, engine: {
      ...E, importSave: load, exportSave: save, applyChapelRuling: value => value,
      applyCombatReactionRuling: value => value, applyTileSpeedRuling: value => value, applyLeapMoveRuling: value => value,
    } });
  assert.equal(ui.el("error").textContent, ""); assert.equal(ui.storage.get(key), saved);
  assert.equal(save(state), saved); return { ui, saved, load };
}
function click(ui, command) {
  const { type, ...args } = command, button = ui.document.querySelectorAll("[data-command]").find(button =>
    button.dataset.command === type && JSON.stringify(JSON.parse(button.dataset.args || "{}")) === JSON.stringify(args));
  assert(button && !button.disabled, "actual UI offers " + JSON.stringify(command)); button.click();
  assert.equal(ui.el("error").textContent, "");
}
const boss = state => state.enemies.find(enemy => enemy.id === "mission-main");

test("the supplied index-417 attack replays exactly: recovery keeps its two defense, mist/rune/card pay once and Regain heals up to six", () => {
  const before = beforeAttack(), beforeSave = E.exportSave(before), preview = P.view(before, E, { ...actualReplay.attack, kind: "ATTACK" }),
    after = E.dispatch(before, actualReplay.attack), afterSave = E.exportSave(after);
  assert.equal(before.commands.length, 417); assert.equal(before.round, 11); assert.equal(before.mission.chapter, 3);
  assert.equal(preview.ready, true); assert.equal(preview.speed, 3); assert.equal(preview.damage, 5);
  assert.equal(after.combat.action.code, "cleric-recovery"); assert.equal(after.combat.action.type, "ability");
  assert.equal(after.combat.removeEnemyAttackEffects, true, "the consumable flag is preserved; its attack-only display scope is separate");
  assert.equal(after.combat.enemyDefense, 2); assert.equal(after.combat.attack.damage, 5);
  assert.equal(boss(before).hp, 8); assert.equal(boss(after).hp, 5);
  assert.equal(boss(before).hp - boss(after).hp, 5 - 2);
  assert.equal(boss(before).insightTokens, 0); assert.equal(boss(after).insightTokens, 0);
  // This actual checkpoint does not demonstrate removal of positive insight.
  assert.notDeepEqual(boss(after).bossDecks[1], boss(before).bossDecks[1]);
  assert.equal(boss(after).bossDecks[1].discard.length, 0);
  assert.equal(after.combat.attack.afterAttackHeal, 2); assert.equal(H(before).hp, 5); assert.equal(H(after).hp, 6);
  assert.equal(H(after).hand.length, H(before).hand.length - 1); assert.equal(H(after).slots[0].id, "card-18");
  assert(!H(after).consumables.some(item => item.id === "item-numbing-mist-1"));
  assert.equal(after.consumableDiscard.filter(item => item.id === "item-numbing-mist-1").length, 1);
  assert.equal(H(before).rewards.find(item => item.id === "reward-28").ready, true);
  assert.equal(H(after).rewards.find(item => item.id === "reward-28").ready, false);
  assert.equal(after.phase, "free_transform"); assert.equal(after.commands.length, 418);
  assert.equal(sha(afterSave), actualReplay.expectedAfterSha256);
  assert.equal(E.exportSave(E.importSave(beforeSave)), beforeSave); assert.equal(E.exportSave(E.importSave(afterSave)), afterSave);
  assert.equal(E.exportSave(before), beforeSave);
});

test("the actual saved recovery comparison keeps its rules and defense visible, omits the false removal caption, and accepts the original free-transform follow-up", () => {
  const state = afterAttack(), { ui, saved } = launch(state), html = ui.el("combatInfo").innerHTML;
  assert.match(html, /마비 안개 · 전용 능력에는 미적용/); assert.match(html, /적 방어 2/);
  assert.doesNotMatch(html, /적 공격의 모든 부가 효과 제거됨|원래 행동 설명 · 현재 공격의 부가 효과 제거됨/);
  const abilityPart = html.split('class="combat-side combat-side-enemy"')[1];
  assert.doesNotMatch(abilityPart, /추가 효과 없음/);
  assert.match(html, /class="combat-rules-caption">행동 설명/);
  assert.match(html, /계몽 토큰을 모두 제거/); assert.match(html, /피해\s*2를 방어/); assert.match(html, /행동 덱을 섞/);
  assert.match(html, /피해 <b>5<\/b>/);
  assert.equal(ui.el("enemyStatusLayer").querySelectorAll("[data-status-enemy]").length, 0);
  ui.el("chapterMap").querySelectorAll("[data-enemy]").find(button => button.dataset.enemy === "mission-main").click();
  const statuses = ui.el("enemyStatusLayer").querySelectorAll("[data-status-enemy]");
  assert.deepEqual(statuses.map(element => element.dataset.statusEnemy), ["mission-main"]);
  assert.match(ui.el("enemyStatusLayer").innerHTML, /aria-valuenow="5" aria-valuemax="8"/);
  assert.equal(ui.storage.get(key), saved); assert.equal(E.exportSave(state), saved);
  click(ui, actualReplay.nextCommand);
  const actual = E.importSave(ui.storage.get(key)); assert.equal(sha(E.exportSave(actual)), actualReplay.expectedNextSha256);
  assert.deepEqual(actual, E.dispatch(state, actualReplay.nextCommand));
  assert.equal(actual.commands.length, 419); assert.equal(actual.phase, "hunter");
  assert.equal(boss(actual).hp, 5); assert.equal(H(actual).hp, 6);
});

test("mist still removes an actual attack's effects and the real combat UI retains the removal badge and ordinary resolution", () => {
  // Supply-valid constructed component fixture, not a canonical player save.
  let state = fixture("cleric-beast", 2, ["strength", "endurance", "vitality"], { item: "numbing-mist", rulesVersion: 14 });
  state = bossAction(state, "grab-throw");
  const itemId = H(state).consumables.find(item => item.kind === "numbing-mist").id,
    before = state, command = { type: "ATTACK", enemyId: state.enemies[0].id, cardId: H(state).hand[0].id, slot: 0, itemIds: [itemId] };
  state = E.dispatch(state, command); E.assertState(state); assert.equal(state.phase, "combat_react");
  assert.equal(state.combat.action.type, "attack"); assert.equal(state.combat.removeEnemyAttackEffects, true);
  for (const effect of ["interrupt", "stun", "bossInsight", "forceHunterMove"]) assert.equal(state.combat.action[effect], false, effect);
  assert.equal(H(state).consumables.length, H(before).consumables.length - 1);
  assert.equal(state.consumableDiscard.filter(item => item.id === itemId).length, 1);
  const { ui, saved, load } = launch(state, false), html = ui.el("combatInfo").innerHTML;
  assert.match(html, /적 공격의 모든 부가 효과 제거됨/); assert.doesNotMatch(html, /마비 안개 · 전용 능력에는 미적용/);
  assert.equal(ui.storage.get(key), saved); click(ui, { type: "RESOLVE" });
  const actual = load(ui.storage.get(key)); assert.deepEqual(actual, E.dispatch(state, { type: "RESOLVE" })); E.assertState(actual);
  assert.equal(actual.commands.length, state.commands.length + 1);
  assert.equal(actual.consumableDiscard.filter(item => item.id === itemId).length, 1);
});
