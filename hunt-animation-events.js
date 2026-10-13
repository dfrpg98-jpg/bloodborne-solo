(function (root) {
  "use strict";
  // This view adapter consumes already public positions and resolved log lines.
  // It never receives a rule engine, deck, unrevealed card or pending reward.
  function publicActors(snapshot) {
    return (snapshot?.actors || []).filter(actor => actor && typeof actor.id === "string" &&
      (actor.kind === "hunter" || actor.kind === "enemy")).map(actor => ({
      id: actor.id, kind: actor.kind, node: actor.node, hp: actor.hp, name: actor.name,
      skin: actor.skin, weaponId: actor.weaponId, weaponFace: actor.weaponFace,
    }));
  }
  function publicEvents(snapshot) {
    return (snapshot?.events || []).filter(event => event && typeof event.text === "string")
      .map(event => ({ round: event.round, text: event.text }));
  }
  function suffix(before, after) {
    const a = publicEvents(before), b = publicEvents(after);
    // The engine keeps the latest 180 log entries. Ordered tail/prefix overlap
    // preserves repeated identical attacks and also works when that log rolls.
    for (let overlap = Math.min(a.length, b.length); overlap >= 0; overlap--) {
      if (a.slice(a.length - overlap).every((event, i) => event.round === b[i].round && event.text === b[i].text))
        return b.slice(overlap).map(event => event.text);
    }
    return [];
  }
  function describe(before, after, commands = []) {
    if (!before || !after || !Number.isFinite(before.revision) || !Number.isFinite(after.revision) || after.revision <= before.revision ||
        before.sceneId !== after.sceneId) return [];
    const oldActors = publicActors(before), actors = publicActors(after), allActors = new Map();
    for (const actor of [...oldActors, ...actors]) allActors.set(actor.id, actor);
    const lines = suffix(before, after), actions = [], acted = new Set();
    const combat = before.combat || after.combat || {}, nextCombat = after.combat || {};
    const commandTarget = [...commands].reverse().find(command => typeof command?.enemyId === "string")?.enemyId;
    const targetId = before.firearmEntry?.enemyId || commandTarget || combat.enemyId || nextCombat.enemyId;
    const targetExists = typeof targetId === "string" && allActors.get(targetId)?.kind === "enemy";
    const publicHunter = actors.find(actor => actor.kind === "hunter") || oldActors.find(actor => actor.kind === "hunter");
    const weaponVisual = value => value && typeof (value.attackSkin || value.skin) === "string" &&
      /^[a-z][a-z0-9_-]{0,40}$/.test(value.attackSkin || value.skin) &&
      Number.isInteger(value.attackSlot) && value.attackSlot >= 0 && value.attackSlot <= 2
      ? { skin: value.attackSkin || value.skin, attackSlot: value.attackSlot, attackStyle: "weapon",
        ...(["slash", "thrust", "sweep", "overhead", "whip", "dual", "claw", "punch", "blast", "shot", "electric", "spirit", "blood"].includes(value.motion) ? { motion: value.motion } : {}) } : null;
    const combatWeapon = weaponVisual(combat) || weaponVisual(nextCombat), shotWeapon = weaponVisual(after.weaponShot);
    const otherVisual = publicHunter?.weaponId ? { attackStyle: "other" } : null;
    const attack = (fromId, toId, damage, type = "attack", visual = null) => {
      if (!allActors.has(fromId) || !allActors.has(toId)) return;
      const key = `${type}:${fromId}:${toId}`;
      if (acted.has(key)) return;
      acted.add(key); actions.push({ type, fromId, toId, ...(Number.isFinite(damage) ? { damage } : {}),
        ...(fromId === "hunter" ? visual || otherVisual : {}) });
    };
    const acceptedWeaponShot = commands.some(command => command?.type === "WEAPON_SHOT");
    if (acceptedWeaponShot && shotWeapon && targetExists) {
      const previous = oldActors.find(actor => actor.id === targetId), current = actors.find(actor => actor.id === targetId);
      const damage = Number.isFinite(previous?.hp) && Number.isFinite(current?.hp)
        ? Math.max(0, previous.hp - current.hp) : previous?.hp;
      attack("hunter", targetId, damage, "shot", shotWeapon);
    }
    // Interrupting pistols fire immediately. A speed-group firearm attack can
    // still be canceled, so its shot waits for the resolved public damage log.
    const declaredFirearmAttack = !!nextCombat.flameName && !before.combat?.flameName;
    const shotUsed = before.firearmReady === true && after.firearmReady === false && !declaredFirearmAttack &&
      commands.some(command => command?.type === "FIREARM" || command?.type === "FIREARM_ENTRY" && command.accept === true);
    if (shotUsed && targetExists) attack("hunter", targetId, undefined, "shot");
    const enemyLabels = new Set([combat.enemyActionName, combat.immediateName, combat.extraName,
      nextCombat.enemyActionName, nextCombat.immediateName, nextCombat.extraName, "다단 가르기 추가 피해"].filter(Boolean));
    const flameNames = new Set([combat.flameName, nextCombat.flameName].filter(Boolean));
    for (const line of lines) {
      const hunterHit = line.match(/^(.+?) · 적에게 (\d+) 피해\.$/);
      if (hunterHit && targetExists)
        attack("hunter", targetId, Number(hunterHit[2]), flameNames.has(hunterHit[1]) ? "shot" : "attack",
          !flameNames.has(hunterHit[1]) && [combat.attackName, nextCombat.attackName].includes(hunterHit[1]) ? combatWeapon : null);
      const enemyHit = line.match(/^(.+?) · 사냥꾼에게 (\d+) 피해\.$/);
      if (enemyHit && targetExists && enemyLabels.has(enemyHit[1]))
        attack(targetId, "hunter", Number(enemyHit[2]));
      // Entry shots report the actual defended damage in their public log.
      const entryHit = line.match(/^.+? · 진입한 .+?에게 피해 (\d+), 화기 소진\.$/);
      if (entryHit && targetExists) {
        const shot = actions.find(action => action.type === "shot" && action.toId === targetId);
        if (shot) shot.damage = Number(entryHit[1]);
        else attack("hunter", targetId, Number(entryHit[1]), "shot");
      }
      const namedHit = line.match(/ · (?:같은 칸 )?(.+?)에게 피해\s*(\d+)\.$/);
      if (namedHit) {
        const candidates = oldActors.filter(actor => actor.kind === "enemy" && actor.name === namedHit[1]);
        const target = candidates.find(actor => !actions.some(action => action.fromId === "hunter" && action.toId === actor.id));
        if (target) {
          const current = actors.find(actor => actor.id === target.id);
          // Some printed weapon-effect log lines report the printed amount.
          // Use visible health loss for the hit pose so defense remains honest.
          const damage = current && Number.isFinite(target.hp) && Number.isFinite(current.hp)
            ? Math.max(0, target.hp - current.hp) : undefined;
          const label = line.split(" · ")[0];
          attack("hunter", target.id, damage, flameNames.has(label) ? "shot" : "attack",
            target.id === targetId && !flameNames.has(label) && [combat.attackName, nextCombat.attackName].includes(label) ? combatWeapon : null);
        }
      }
    }
    // Item, reward and splash damage may name a public enemy instead of a
    // combat target. A visible health decrease supplies that exact actor ID.
    const externalDamage = commands.some(command => ["USE_CONSUMABLE", "USE_REWARD", "WEAPON_CHOICE", "ENTRY_WEAPON",
      "WEAPON_SHOT", "CHEAP_SHOT", "FIREARM", "FIREARM_ENTRY"].includes(command?.type));
    if (externalDamage) for (const previous of oldActors.filter(actor => actor.kind === "enemy")) {
      const current = actors.find(actor => actor.id === previous.id);
      if (Number.isFinite(previous.hp) && Number.isFinite(current?.hp) && current.hp < previous.hp &&
          !actions.some(action => action.fromId === "hunter" && action.toId === previous.id))
        attack("hunter", previous.id, previous.hp - current.hp,
          shotUsed ? "shot" : "attack");
      else if (!current && previous.id === targetId && previous.name &&
          lines.some(line => line.startsWith(`${previous.name} 처치 ·`)) &&
          !actions.some(action => action.fromId === "hunter" && action.toId === previous.id))
        attack("hunter", previous.id, previous.hp, shotUsed ? "shot" : "attack");
    }
    // These are rule results, including automatic pursuit/activation and forced
    // moves. Camera scrolling or re-rendering can never create a move action.
    const respawn = lines.some(line => /^지도 초기화/.test(line));
    for (const previous of oldActors) {
      const current = actors.find(actor => actor.id === previous.id);
      if (current && typeof previous.node === "string" && typeof current.node === "string" &&
          previous.node !== current.node && !(respawn && previous.kind === "enemy"))
        actions.push({ type: "move", fromId: previous.id, fromNode: previous.node, toNode: current.node });
    }
    const previousHunter = oldActors.find(actor => actor.kind === "hunter"), currentHunter = actors.find(actor => actor.kind === "hunter");
    if (previousHunter && currentHunter && previousHunter.weaponId === currentHunter.weaponId &&
      (previousHunter.weaponFace === 0 || previousHunter.weaponFace === 1) &&
      currentHunter.weaponFace !== previousHunter.weaponFace &&
      commands.some(command => command?.type === "TRANSFORM" || command?.type === "FREE_TRANSFORM" && command.accept === true))
      actions.push({ type: "transform", fromId: currentHunter.id, skin: currentHunter.skin });
    return actions;
  }
  const api = { describe };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BBHuntAnimationEvents = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
