(function (root) {
  "use strict";
  const copy = value => JSON.parse(JSON.stringify(value));
  const normalize = command => {
    const { args, ...rest } = command;
    return { ...rest, ...(args && typeof args === "object" ? args : {}) };
  };
  function departureRequest(before, after, command, E) {
    const from = E.hunter(before)?.position, to = E.hunter(after)?.position;
    if (!from || before.phase !== "move") return null;
    if (command.type === "STEP" && to && from !== to) return from;
    // Exploration decides departure while the existing free pickup command is
    // still legal. Actual tile entry later uses this saved decision, including
    // entry delayed by enemy spawn choices. Placement never asks again.
    if (command.type === "EXPLORE" && before.move && after.phase === "tile_place") return from;
    return null;
  }
  function available(E, before, from) {
    const actions = E.missionActions?.(before) || [];
    const view = E.missionView?.(before);
    if (!view || !Array.isArray(view.tokens)) return null;
    for (const action of actions) {
      if (action?.command?.type !== "MISSION_PICKUP") continue;
      const command = normalize(action.command), tokenId = command.tokenId || action.tokenId || "escort";
      const token = view.tokens.find(token => token.id === tokenId && token.node === from && !token.carrierId);
      if (!token) continue;
      // The existing action proves this is a free departure companion. The
      // uncaptured rescue/experiment tokens and NPC-follow actions are excluded.
      const armed = typeof token.pickup === "boolean" ? token.pickup :
        token.id === "escort" ? !!before.mission?.escort?.pickup : !!action.selected;
      const another = !!before.activeHunterId && view.tokens.some(other => other.id !== token.id && other.carrierId === before.activeHunterId);
      return { tokenId: token.id, name: typeof token.name === "string" ? token.name : "생존자",
        command, armed, another };
    }
    return null;
  }
  function replay(E, state, commands) {
    let result = copy(state);
    for (const command of commands) result = E.dispatch(result, copy(command));
    return result;
  }
  function plan(E, state, commands) {
    if (!E || typeof E.dispatch !== "function" || typeof E.hunter !== "function" ||
        !state || !Array.isArray(commands) || !commands.length) return null;
    let preview = copy(state), found = null;
    const requested = copy(commands);
    try {
      // Validate the entire original batch before describing a choice. Inspect
      // only visible companions at the walking boundary, never rule/deck data.
      for (let index = 0; index < requested.length; index++) {
        const before = preview, command = requested[index];
        preview = E.dispatch(preview, copy(command));
        const from = departureRequest(before, preview, command, E);
        if (!found && from) {
          const candidate = available(E, before, from);
          if (candidate) found = { ...candidate, index, from };
        }
      }
      if (!found) return null;
      const inject = command => [...requested.slice(0, found.index), copy(command), ...requested.slice(found.index)];
      const acceptCommands = found.armed ? copy(requested) : inject(found.command);
      const declineCommands = found.armed ? inject(found.command) : copy(requested);
      // Either answer must remain a valid batch. A prompt never commits the
      // preview, spends a card or changes an already-carried companion.
      replay(E, state, acceptCommands); replay(E, state, declineCommands);
      return {
        title: found.another ? "다른 생존자와 동행하시겠습니까?" : "생존자와 동행하시겠습니까?",
        tokenId: found.tokenId, name: found.name,
        acceptCommands: copy(acceptCommands), declineCommands: copy(declineCommands),
        sourceRevision: state.revision, fromNode: found.from,
      };
    } catch (_) {
      // The caller's existing command handler reports invalid actions. They
      // must not produce a companion question or partially execute a batch.
      return null;
    }
  }
  const api = { plan };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BBHuntDeparture = api;
})(typeof globalThis !== "undefined" ? globalThis : this);


