'use strict';
// Authoritative state stays in the oracle. This is an allowlist, never a clone
// followed by deletion: newly added private fields cannot cross this boundary.
module.exports = function makePublicView(E, PublicText, Visuals, campaign) {
  function attackVisual(state) {
    const c = state.combat, h = E.hunter(state);
    if (!c?.attack) return null;
    const commands = state.commands;
    let index = commands.length - 1;
    while (index >= 0 && !(['ATTACK', 'COUNTER'].includes(commands[index].type) &&
      Number.isInteger(commands[index].slot) && (!commands[index].enemyId || commands[index].enemyId === c.enemyId))) index--;
    const faces = E.data.weapons[h.weaponId]?.faces || [];
    let face = c.attack.weaponFace ? faces.findIndex(x => JSON.stringify(x) === JSON.stringify(c.attack.weaponFace)) : h.face;
    if (face < 0) face = h.face;
    const slot = index >= 0 ? commands[index].slot : faces[face]?.slots?.findIndex(x => x.name === c.attack.name);
    // Recover charge at declaration, exactly as the existing presentation does.
    let charged = false;
    if (h.weaponId === 'tonitrus' && index >= 0) {
      const setup = state.setup;
      let replay = E.create(state.initialSeed, setup.weaponId, setup.face, setup.startingConsumable,
        setup.firearmId, setup.startSpace, { ...setup, campaign: !!setup.campaign, rulesVersion: setup.rulesVersion ?? null });
      for (const command of commands.slice(0, index)) replay = E.dispatch(replay, command);
      charged = E.hunter(replay).weaponCharge?.round === replay.round;
    }
    return Visuals.attack(h.weaponId, face, slot, charged);
  }
  return function project(state, sessionId = 'session-1') {
    const h = E.hunter(state), c = state.combat, visual = attackVisual(state);
    const snapshot = {
      format: 'bloodborne-public-view', version: 1,
      // Scene identity is presentation lifecycle metadata, never the private
      // deterministic seed. Direct projections use a stable parity identity.
      sceneId: `${sessionId}:${state.mission?.chapter || 0}:unity-prep`,
      revision: state.revision, phase: state.phase, result: state.result,
      round: state.round, track: state.track,
      firearmReady: h.firearmReady,
      hunter: { id: h.id, hp: h.hp, echoes: h.echoes, position: h.position,
        hand: h.hand.map(x => ({ id: x.id, kind: x.kind, name: E.card(x).name })),
        slots: h.slots, status: h.status, consumables: h.consumables,
        weaponId: h.weaponId, face: h.face, firearmId: h.firearmId },
      // E.nodes/edges reflect placed tiles only; world.tileDeck never leaves.
      tiles: state.world.tiles.map(({ tileId, x, y, rotation }) => ({ tileId, x, y, rotation })),
      nodes: E.nodes(state), edges: E.edges(state),
      actors: [{ id: 'hunter', kind: 'hunter', node: h.position, hp: h.hp,
        weaponId: h.weaponId, weaponFace: h.face,
        skin: Visuals.skin(h.weaponId, h.face, h.weaponCharge?.round === state.round) },
        ...state.enemies.map(e => ({ id: e.id, kind: 'enemy', node: e.node, hp: e.hp, name: E.enemyDef(state, e).name }))],
      events: state.events.map(({ round, text }) => ({ round, text })),
      combat: c ? { enemyId: c.enemyId, attackName: c.attack?.name, enemyActionName: c.action?.name,
        ...(visual ? { attackSlot: visual.attackSlot, attackSkin: visual.skin, attackStyle: visual.attackStyle,
          motion: visual.motion, weaponId: visual.weaponId, weaponFace: visual.weaponFace } : {}),
        immediateName: c.immediate?.name || c.immediate?.label,
        extraName: c.extra?.name || c.extra?.label,
        flameName: c.flame ? c.flame.name || E.firearm(state).name : undefined } : null,
      weaponShot: state.commands.at(-1)?.type === 'WEAPON_SHOT'
        ? Visuals.attack(h.weaponId, h.face, state.commands.at(-1).slot, h.weaponCharge?.round === state.round) : null,
      firearmEntry: state.firearmEntry ? { enemyId: state.firearmEntry.enemyId } : null,
      chapter: state.mission ? PublicText.chapter(state, E.missionView(state), campaign) : null,
      rewards: E.rewardsView(state),
      reactionActions: typeof E.killReactionActions === 'function' ? E.killReactionActions(state) : [],
    };
    // JSON transport has the same undefined/optional-field semantics as saves.
    return JSON.parse(JSON.stringify(snapshot));
  };
};
