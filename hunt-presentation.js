(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else root.BBHuntPresentation = factory;
})(typeof globalThis !== "undefined" ? globalThis : this, function (options) {
  "use strict";
  const document = options.document, Phaser = options.Phaser;
  const viewport = options.viewport, host = options.host;
  const view = document?.defaultView || (typeof globalThis !== "undefined" ? globalThis : {});
  const media = view.matchMedia?.("(prefers-reduced-motion: reduce)");
  const actors = new Map(), effects = new Set();
  let game = null, scene = null, pending = null, destroyed = false, failed = false;
  let lastRevision = null, motionReduced = !!media?.matches;
  let moves = 0, attacks = 0, width = 0, height = 0;

  // This layer accepts only the public coordinates that the UI has already drawn.
  // No rules state, commands, cards, decks, random numbers or save data enter it.
  function publicActors(list) {
    if (!Array.isArray(list)) return [];
    return list.slice(0, 100).filter(a => a && typeof a.id === "string" &&
      (a.kind === "hunter" || a.kind === "enemy") && Number.isFinite(a.x) && Number.isFinite(a.y))
      .map(a => ({ id: a.id.slice(0, 100), kind: a.kind, x: a.x, y: a.y }));
  }
  function publish() {
    if (host?.dataset) {
      host.dataset.presentation = destroyed ? "stopped" : failed || !Phaser ? "fallback" : scene ? "phaser" : "loading";
      host.dataset.presentationVersion = Phaser?.VERSION || "";
      host.dataset.presentationMoves = String(moves);
      host.dataset.presentationAttacks = String(attacks);
      host.dataset.presentationMotion = motionReduced ? "reduced" : "full";
    }
  }
  function dispose(object) {
    effects.delete(object);
    object?.destroy?.();
  }
  function clearEffects() {
    scene?.tweens?.killAll?.();
    for (const effect of effects) effect?.destroy?.();
    effects.clear();
  }
  function fail() {
    failed = true;
    clearEffects();
    game?.destroy?.(true);
    scene = null;
    publish();
  }
  function configureCanvas() {
    const canvas = game?.canvas;
    if (canvas) {
      canvas.setAttribute?.("aria-hidden", "true");
      canvas.setAttribute?.("tabindex", "-1");
      canvas.style.pointerEvents = "none";
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    }
  }
  function graphic() {
    const g = scene.add.graphics();
    effects.add(g);
    return g;
  }
  function tween(object, values) {
    scene.tweens.add(Object.assign({ targets: object, ease: "Sine.easeOut", onComplete: () => dispose(object) }, values));
  }
  function silhouette(actor) {
    const g = graphic();
    const hunter = actor.kind === "hunter", color = hunter ? 0xf0d697 : 0xcf7d6c;
    g.lineStyle(2, color, .9);
    g.fillStyle(0x131720, .94);
    if (hunter) {
      // Original geometric coat, brimmed hat and blade, drawn at runtime.
      g.fillPoints([{ x: -5, y: -8 }, { x: 5, y: -8 }, { x: 10, y: 13 }, { x: -10, y: 13 }], true);
      g.strokePoints([{ x: -5, y: -8 }, { x: 5, y: -8 }, { x: 10, y: 13 }, { x: -10, y: 13 }], true);
      g.fillCircle(0, -12, 5);
      g.lineBetween(-10, -12, 10, -12);
      g.lineBetween(8, 3, 18, -8);
    } else {
      g.fillPoints([{ x: -11, y: 10 }, { x: -7, y: -8 }, { x: -3, y: -15 }, { x: 1, y: -7 }, { x: 6, y: -14 }, { x: 11, y: 10 }], true);
      g.strokePoints([{ x: -11, y: 10 }, { x: -7, y: -8 }, { x: -3, y: -15 }, { x: 1, y: -7 }, { x: 6, y: -14 }, { x: 11, y: 10 }], true);
      g.lineBetween(-8, 7, -17, 12);
      g.lineBetween(8, 7, 17, 12);
    }
    return g;
  }
  function moveActor(before, after) {
    const trail = graphic();
    trail.lineStyle(3, after.kind === "hunter" ? 0xd8bc78 : 0xaf6458, .6);
    trail.lineBetween(before.x, before.y, after.x, after.y);
    tween(trail, { alpha: 0, duration: 420 });
    const unit = silhouette(after);
    unit.setPosition(before.x, before.y);
    tween(unit, { x: after.x, y: after.y, alpha: 0, duration: 360 });
    moves += 1;
  }
  function attack(from, to) {
    if (!to) return;
    const g = graphic();
    const color = from?.kind === "enemy" ? 0xd98370 : 0xf4d28c;
    g.lineStyle(3, color, .95);
    if (from && Math.hypot(from.x - to.x, from.y - to.y) > 3) g.lineBetween(from.x, from.y, to.x, to.y);
    g.strokeCircle(to.x, to.y, 21);
    g.lineBetween(to.x - 16, to.y + 14, to.x + 18, to.y - 18);
    g.lineBetween(to.x - 9, to.y - 17, to.x + 12, to.y + 14);
    tween(g, { alpha: 0, duration: 420 });
    attacks += 1;
  }
  function apply(snapshot) {
    const current = new Map(snapshot.actors.map(a => [a.id, a]));
    const action = snapshot.action;
    const changedRevision = lastRevision !== null && snapshot.revision !== lastRevision;
    if (scene && !failed && !motionReduced && changedRevision && action) {
      // A UI refresh, selection or camera scroll is never treated as a move.
      if (action.type === "move") for (const a of current.values()) {
        if (action.fromId && action.fromId !== a.id) continue;
        const before = actors.get(a.id);
        if (before && Math.hypot(before.x - a.x, before.y - a.y) > 2) moveActor(before, a);
      }
      if (action.type === "attack") {
        attack(current.get(action.fromId) || actors.get(action.fromId), current.get(action.toId) || actors.get(action.toId));
      }
    }
    actors.clear();
    for (const actor of current.values()) actors.set(actor.id, actor);
    lastRevision = snapshot.revision;
    publish();
  }
  function sync(snapshot) {
    if (destroyed) return;
    const action = snapshot?.action;
    const clean = { revision: Number.isFinite(snapshot?.revision) ? snapshot.revision : 0,
      actors: publicActors(snapshot?.actors),
      action: action && (action.type === "move" || action.type === "attack") ?
        { type: action.type, fromId: String(action.fromId || ""), toId: String(action.toId || "") } : null };
    if (!scene && !failed && Phaser) { pending = clean; return; }
    try { apply(clean); } catch (_) { fail(); }
  }
  function resize(size) {
    if (destroyed) return;
    const w = Math.max(1, Math.round(size?.width ?? viewport?.clientWidth ?? 1));
    const h = Math.max(1, Math.round(size?.height ?? viewport?.clientHeight ?? 1));
    if (w === width && h === height) return;
    width = w; height = h;
    if (scene && game && !failed) {
      clearEffects();
      try { game.scale.resize(width, height); configureCanvas(); } catch (_) { fail(); }
    }
  }
  function focus(point) {
    if (!scene || destroyed || failed || motionReduced || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
    // Framing stays aligned with the rules map; the UI owns bounded map scrolling.
    const g = graphic(), x = point.x, y = point.y, r = 30, arm = 10;
    g.lineStyle(2, 0xdfc38a, .8);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      g.lineBetween(x + sx * r, y + sy * r, x + sx * (r - arm), y + sy * r);
      g.lineBetween(x + sx * r, y + sy * r, x + sx * r, y + sy * (r - arm));
    }
    tween(g, { alpha: 0, duration: 500 });
  }
  function onMotion(event) {
    motionReduced = !!event.matches;
    if (motionReduced) clearEffects();
    publish();
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    media?.removeEventListener?.("change", onMotion);
    clearEffects();
    game?.destroy?.(true);
    actors.clear(); pending = null; scene = null;
    publish();
  }
  function status() {
    return { renderer: destroyed ? "stopped" : failed || !Phaser ? "fallback" : scene ? "phaser" : "loading",
      version: Phaser?.VERSION || null, reducedMotion: motionReduced, moves, attacks, effects: effects.size };
  }
  media?.addEventListener?.("change", onMotion);
  resize();
  if (Phaser?.Game && host && document?.createElement) {
    try {
      game = new Phaser.Game({
        type: Phaser.CANVAS, parent: host, width, height, transparent: true, banner: false,
        audio: { noAudio: true }, input: { mouse: false, touch: false, keyboard: false, gamepad: false },
        fps: { target: 30 }, render: { antialias: true, roundPixels: false },
        scene: { create: function () {
          if (destroyed) return;
          scene = this;
          configureCanvas();
          publish();
          if (pending) { const latest = pending; pending = null; apply(latest); }
        } }
      });
      configureCanvas();
    } catch (_) { fail(); }
  } else failed = true;
  publish();
  return { sync, resize, focus, destroy, status };
});
