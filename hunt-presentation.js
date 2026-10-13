(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else root.BBHuntPresentation = factory;
})(typeof globalThis !== "undefined" ? globalThis : this, function (options) {
  "use strict";
  const document = options.document, Phaser = options.Phaser;
  const viewport = options.viewport, host = options.host;
  const browser = document?.defaultView || (typeof globalThis !== "undefined" ? globalThis : {});
  const media = browser.matchMedia?.("(prefers-reduced-motion: reduce)");
  const actors = new Map(), units = new Map(), effects = new Set(), sheets = new Map(), timers = new Set();
  for (const [skin, data] of Object.entries(options.characters || {})) {
    if (!/^[a-z][a-z0-9_-]{0,40}$/.test(skin) || !data || typeof data.path !== "string" ||
      !/^assets\/characters\/[a-z0-9_.-]+\.png$/.test(data.path) ||
      !Number.isInteger(data.frameWidth) || !Number.isInteger(data.frameHeight) ||
      data.frameWidth < 16 || data.frameHeight < 16) continue;
    sheets.set(skin, { key: "bb-character-" + skin, path: data.path,
      atlasPath: typeof data.atlasPath === "string" && /^assets\/characters\/[a-z0-9_.-]+\.json$/.test(data.atlasPath) ? data.atlasPath : null,
      atlasData: cleanAtlas(data.atlasData, data.frameWidth, data.frameHeight),
      frameWidth: data.frameWidth, frameHeight: data.frameHeight,
      displayHeight: Number.isFinite(data.displayHeight) ? Math.max(24, Math.min(160, data.displayHeight)) : skin === "boss" ? 104 : 72,
      originY: Number.isFinite(data.originY) ? Math.max(.5, Math.min(1, data.originY)) : .86 });
  }
  let game = null, scene = null, pending = null, destroyed = false, failed = false;
  let lastRevision = null, lastSceneId = null, lastView = null, motionReduced = !!media?.matches;
  let charactersReady = false, moves = 0, attacks = 0, shots = 0, width = 0, height = 0, effectEpoch = 0;

  function cleanAtlas(value, sourceWidth, sourceHeight) {
    if (!value || !value.frames || !value.meta?.size) return null;
    const size = value.meta.size;
    const positive = n => Number.isInteger(n) && n > 0 && n <= 8192;
    const nonnegative = n => Number.isInteger(n) && n >= 0 && n <= 8192;
    if (!positive(size.w) || !positive(size.h)) return null;
    const frames = {};
    for (let index = 0; index < 16; index++) {
      const item = value.frames[String(index)], rect = item?.frame, trim = item?.spriteSourceSize, source = item?.sourceSize;
      if (!rect || !trim || !source || item.rotated === true ||
        !nonnegative(rect.x) || !nonnegative(rect.y) || !positive(rect.w) || !positive(rect.h) ||
        rect.x + rect.w > size.w || rect.y + rect.h > size.h ||
        !nonnegative(trim.x) || !nonnegative(trim.y) || trim.w !== rect.w || trim.h !== rect.h ||
        source.w !== sourceWidth || source.h !== sourceHeight ||
        trim.x + trim.w > source.w || trim.y + trim.h > source.h) return null;
      frames[String(index)] = { frame: { x: rect.x, y: rect.y, w: rect.w, h: rect.h }, rotated: false,
        trimmed: item.trimmed === true, spriteSourceSize: { x: trim.x, y: trim.y, w: trim.w, h: trim.h },
        sourceSize: { w: source.w, h: source.h } };
    }
    // Inline numeric atlas rectangles avoid JSON XHR under file:// and do not
    // carry arbitrary metadata or any game information into Phaser's loader.
    return { frames, meta: { size: { w: size.w, h: size.h }, scale: "1" } };
  }

  // Only already-public actor positions and resolved effects cross this boundary.
  // Rules state, decks, future cards, commands, randomness and saves stay outside it.
  function publicActors(list) {
    if (!Array.isArray(list)) return [];
    return list.slice(0, 100).filter(a => a && typeof a.id === "string" &&
      (a.kind === "hunter" || a.kind === "enemy") && Number.isFinite(a.x) && Number.isFinite(a.y))
      .map(a => ({ id: a.id.slice(0, 100), kind: a.kind, x: a.x, y: a.y,
        skin: typeof a.skin === "string" && sheets.has(a.skin) ? a.skin : a.kind === "hunter" ? "hunter" : "mob",
        scale: Number.isFinite(a.scale) ? Math.max(.25, Math.min(4, a.scale)) : 1,
        hp: Number.isFinite(a.hp) ? Math.max(0, a.hp) : null,
        selected: a.selected === true }));
  }
  function cleanPoint(value) {
    return value && Number.isFinite(value.x) && Number.isFinite(value.y) ? { x: value.x, y: value.y } : null;
  }
  function cleanAction(action) {
    if (!action || !["move", "attack", "shot"].includes(action.type)) return null;
    return { type: action.type, fromId: String(action.fromId || "").slice(0, 100),
      toId: String(action.toId || "").slice(0, 100), from: cleanPoint(action.from), to: cleanPoint(action.to),
      damage: Number.isFinite(action.damage) ? Math.max(0, action.damage) : null };
  }
  function cleanView(value) {
    if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.zoom) || value.zoom <= 0) return null;
    return { x: value.x, y: value.y, zoom: value.zoom };
  }
  function publish() {
    if (host?.dataset) {
      host.dataset.presentation = destroyed ? "stopped" : failed || !Phaser ? "fallback" : scene ? "phaser" : "loading";
      host.dataset.presentationVersion = Phaser?.VERSION || "";
      host.dataset.presentationMoves = String(moves);
      host.dataset.presentationAttacks = String(attacks);
      host.dataset.presentationShots = String(shots);
      host.dataset.presentationMotion = motionReduced ? "reduced" : "full";
      host.dataset.presentationCharacters = charactersReady ? "ready" : !scene && !failed && sheets.size ? "loading" : "fallback";
      host.dataset.presentationActors = String(units.size);
    }
  }
  function setReady(value) {
    const changed = charactersReady !== value;
    charactersReady = value; publish();
    if (changed) { try { options.onReady?.(value); } catch (_) { /* UI fallback cannot affect rules. */ } }
  }
  function dispose(object) { effects.delete(object); object?.destroy?.(); }
  function cancelUnitMotion(unit, snap) {
    unit.epoch += 1;
    scene?.tweens?.killTweensOf?.(unit.sprite);
    unit.sprite?.removeAllListeners?.("animationcomplete-" + unit.animation);
    if (snap && unit.actor) unit.sprite?.setPosition?.(unit.actor.x, unit.actor.y);
    unit.moving = false;
  }
  function removeUnit(id) {
    const unit = units.get(id);
    if (!unit) return;
    cancelUnitMotion(unit, false); unit.sprite?.anims?.stop?.();
    unit.sprite?.destroy?.(); unit.shadow?.destroy?.(); units.delete(id);
  }
  function clearEffects() {
    effectEpoch += 1;
    for (const timer of timers) timer.remove?.(false);
    timers.clear();
    scene?.tweens?.killAll?.();
    for (const effect of effects) effect?.destroy?.();
    effects.clear();
    for (const unit of units.values()) {
      cancelUnitMotion(unit, true);
      if (unit.dying || unit.pendingDeath) removeUnit(unit.actor.id); else idle(unit);
    }
  }
  function fail() {
    failed = true; setReady(false);
    try { clearEffects(); } catch (_) { /* A failed canvas cannot block game UI. */ }
    for (const id of [...units.keys()]) { try { removeUnit(id); } catch (_) { units.delete(id); } }
    try { game?.destroy?.(true); } catch (_) { /* Retain the DOM renderer if Phaser cleanup fails. */ }
    scene = null; publish();
  }
  function configureCanvas() {
    const canvas = game?.canvas;
    if (canvas) {
      canvas.setAttribute?.("aria-hidden", "true"); canvas.setAttribute?.("tabindex", "-1");
      canvas.style.pointerEvents = "none"; canvas.style.display = "block";
      canvas.style.width = "100%"; canvas.style.height = "100%";
    }
  }
  function fitLoadedCanvas() {
    const canvas = game?.canvas;
    // The HUD may resize while Phaser's async asset loader still owns boot.
    // Commit the latest viewport size at create, before positioning actors.
    if (game?.scale?.resize && Number.isFinite(canvas?.width) && Number.isFinite(canvas?.height) &&
      (canvas.width !== width || canvas.height !== height)) game.scale.resize(width, height);
    configureCanvas();
  }
  function graphic() { const g = scene.add.graphics(); effects.add(g); return g; }
  function tween(object, values) {
    scene.tweens.add(Object.assign({ targets: object, ease: "Sine.easeOut", onComplete: () => dispose(object) }, values));
  }
  function animationKey(skin, pose) { return "bb-" + skin + "-" + pose; }
  function registerAnimations() {
    if (!scene?.add?.sprite || !scene.anims?.create || !scene.textures?.exists || !sheets.size) return;
    // Partial/failed sprite loads keep the DOM fallback visible for every actor.
    if (![...sheets.values()].every(data => {
      const texture = scene.textures.get?.(data.key);
      return scene.textures.exists(data.key) && (!texture?.has || texture.has(data.atlasPath ? "15" : 15));
    })) return;
    for (const [skin, data] of sheets) for (const [pose, frames, frameRate, repeat] of [
      ["idle", [0, 1, 2, 3], 3, -1], ["walk", [4, 5, 6, 7], 10, -1],
      ["attack", [8, 9, 10, 11], 14, 0], ["hit", [12, 13], 8, 0], ["death", [14, 15], 5, 0]
    ]) {
      const key = animationKey(skin, pose);
      if (!scene.anims.exists?.(key)) scene.anims.create({ key,
        frames: data.atlasPath ? frames.map(frame => ({ key: data.key, frame: String(frame) })) : scene.anims.generateFrameNumbers(data.key, { frames }),
        frameRate, repeat });
    }
    setReady(true);
  }
  function idle(unit) {
    if (!unit || unit.dying || !unit.sprite) return;
    unit.animation = animationKey(unit.actor.skin, "idle");
    if (motionReduced) { unit.sprite.anims?.stop?.(); unit.sprite.setFrame?.(sheets.get(unit.actor.skin)?.atlasPath ? "0" : 0); }
    else unit.sprite.play?.(unit.animation, true);
  }
  function pose(unit, name, complete) {
    if (!unit || unit.dying || motionReduced) return;
    const key = animationKey(unit.actor.skin, name), epoch = ++unit.epoch;
    unit.animation = key; unit.sprite.play?.(key);
    if (complete) unit.sprite.once?.("animationcomplete-" + key, () => {
      if (units.get(unit.actor.id) === unit && unit.epoch === epoch && !unit.dying) complete();
    });
  }
  function updateUnit(unit, actor) {
    const prior = unit.actor; unit.actor = actor;
    const data = sheets.get(actor.skin);
    if (prior?.skin !== actor.skin) {
      cancelUnitMotion(unit, false); unit.sprite.setTexture?.(data.key, data.atlasPath ? "0" : 0); idle(unit);
    }
    const h = data.displayHeight * actor.scale;
    unit.sprite.setDisplaySize?.(h * data.frameWidth / data.frameHeight, h);
    unit.sprite.setDepth?.(100 + actor.y); unit.sprite.setOrigin?.(.5, data.originY);
    unit.shadow?.setPosition?.(unit.moving ? unit.sprite.x : actor.x, (unit.moving ? unit.sprite.y : actor.y) + 2);
    unit.shadow?.setScale?.(actor.scale); unit.shadow?.setDepth?.(actor.y);
  }
  function createUnit(actor) {
    const data = sheets.get(actor.skin);
    if (!data) return null;
    const sprite = scene.add.sprite(actor.x, actor.y, data.key, data.atlasPath ? "0" : 0), shadow = scene.add.graphics();
    shadow.fillStyle?.(0x07080a, .42); shadow.fillEllipse?.(0, 0, actor.skin === "boss" ? 35 : 24, 9);
    const unit = { actor, sprite, shadow, epoch: 0, animation: "", moving: false, dying: false, pendingDeath: false };
    units.set(actor.id, unit); updateUnit(unit, actor); idle(unit); return unit;
  }
  function silhouette(actor) {
    const g = graphic(), hunter = actor.kind === "hunter", color = hunter ? 0xf0d697 : 0xcf7d6c;
    g.lineStyle(2, color, .9); g.fillStyle(0x131720, .94);
    if (hunter) {
      g.fillPoints([{ x: -5, y: -8 }, { x: 5, y: -8 }, { x: 10, y: 13 }, { x: -10, y: 13 }], true);
      g.strokePoints([{ x: -5, y: -8 }, { x: 5, y: -8 }, { x: 10, y: 13 }, { x: -10, y: 13 }], true);
      g.fillCircle(0, -12, 5); g.lineBetween(-10, -12, 10, -12); g.lineBetween(8, 3, 18, -8);
    } else {
      g.fillPoints([{ x: -11, y: 10 }, { x: -7, y: -8 }, { x: -3, y: -15 }, { x: 1, y: -7 }, { x: 6, y: -14 }, { x: 11, y: 10 }], true);
      g.strokePoints([{ x: -11, y: 10 }, { x: -7, y: -8 }, { x: -3, y: -15 }, { x: 1, y: -7 }, { x: 6, y: -14 }, { x: 11, y: 10 }], true);
      g.lineBetween(-8, 7, -17, 12); g.lineBetween(8, 7, 17, 12);
    }
    return g;
  }
  function moveActor(before, after) {
    const unit = units.get(after.id);
    if (charactersReady && unit) {
      cancelUnitMotion(unit, false); unit.sprite.setPosition(before.x, before.y);
      unit.sprite.setFlipX?.(after.x < before.x); unit.moving = true; pose(unit, "walk");
      const epoch = unit.epoch;
      scene.tweens.add({ targets: unit.sprite, x: after.x, y: after.y, duration: 340, ease: "Sine.easeInOut",
        onUpdate: () => { unit.shadow?.setPosition?.(unit.sprite.x, unit.sprite.y + 2); unit.sprite.setDepth?.(100 + unit.sprite.y); },
        onComplete: () => { if (unit.epoch === epoch && units.get(after.id) === unit) { unit.moving = false; idle(unit); } } });
    } else {
      const trail = graphic(); trail.lineStyle(3, after.kind === "hunter" ? 0xd8bc78 : 0xaf6458, .6);
      trail.lineBetween(before.x, before.y, after.x, after.y); tween(trail, { alpha: 0, duration: 420 });
      const temporary = silhouette(after); temporary.setPosition(before.x, before.y);
      tween(temporary, { x: after.x, y: after.y, alpha: 0, duration: 360 });
    }
    moves += 1;
  }
  function defeat(unit) {
    if (!unit || unit.dying) return;
    cancelUnitMotion(unit, false); unit.dying = true; unit.pendingDeath = false; unit.animation = animationKey(unit.actor.skin, "death");
    unit.sprite.play?.(unit.animation); const epoch = unit.epoch;
    scene.tweens.add({ targets: unit.sprite, alpha: 0, duration: 560, delay: 160, ease: "Sine.easeIn",
      onComplete: () => { if (unit.epoch === epoch && units.get(unit.actor.id) === unit) { removeUnit(unit.actor.id); publish(); } } });
  }
  function attack(from, to, damaged, defeated, shot) {
    if (!to) return;
    const unit = units.get(from?.id), target = units.get(to.id);
    if (unit && !shot) { cancelUnitMotion(unit, true); unit.sprite.setFlipX?.(to.x < from.x); pose(unit, "attack", () => idle(unit)); }
    if (target) { if (defeated) defeat(target); else if (damaged) { cancelUnitMotion(target, true); pose(target, "hit", () => idle(target)); } }
    const g = graphic(), color = from?.kind === "enemy" ? 0xd98370 : 0xf4d28c;
    g.lineStyle(shot ? 2 : 3, color, .95);
    if (from && Math.hypot(from.x - to.x, from.y - to.y) > 3) g.lineBetween(from.x, from.y, to.x, to.y);
    if (shot) { if (from) { g.fillStyle(color, .95); g.fillCircle(from.x, from.y - 12, 7); } if (damaged || defeated) g.strokeCircle(to.x, to.y, 12); }
    else { g.strokeCircle(to.x, to.y, 21); g.lineBetween(to.x - 16, to.y + 14, to.x + 18, to.y - 18); g.lineBetween(to.x - 9, to.y - 17, to.x + 12, to.y + 14); }
    tween(g, { alpha: 0, duration: shot ? 260 : 420 });
    if (shot) shots += 1; else attacks += 1;
  }
  function later(callback, delay) {
    if (!delay || !scene?.time?.delayedCall) { callback(); return; }
    const epoch = effectEpoch;
    let timer;
    timer = scene.time.delayedCall(delay, () => {
      timers.delete(timer);
      if (!destroyed && !failed && !motionReduced && epoch === effectEpoch) {
        try { callback(); publish(); } catch (_) { fail(); }
      }
    });
    timers.add(timer);
  }
  function adjusted(actor, nextView) {
    if (!lastView || !nextView) return actor;
    const ratio = nextView.zoom / lastView.zoom;
    return Object.assign({}, actor, { x: (actor.x + lastView.x) * ratio - nextView.x, y: (actor.y + lastView.y) * ratio - nextView.y });
  }
  function apply(snapshot) {
    const current = new Map(snapshot.actors.map(a => [a.id, a]));
    const reset = lastRevision !== null && (snapshot.revision < lastRevision || snapshot.sceneId !== lastSceneId);
    const changedRevision = !reset && lastRevision !== null && snapshot.revision > lastRevision;
    const beforeActors = new Map([...actors].map(([id, a]) => [id, adjusted(a, snapshot.view)]));
    if (reset || changedRevision) clearEffects();
    if (reset) for (const id of [...units.keys()]) removeUnit(id);
    const actions = changedRevision ? snapshot.actions : [], deathIds = new Set();
    if (!motionReduced) for (const action of actions) if (["attack", "shot"].includes(action.type) && !current.has(action.toId) && beforeActors.has(action.toId)) deathIds.add(action.toId);
    if (charactersReady) {
      for (const actor of current.values()) {
        let unit = units.get(actor.id);
        if (unit?.dying) { removeUnit(actor.id); unit = null; }
        if (!unit) createUnit(actor);
        else {
          const moving = unit.moving, oldActor = unit.actor; updateUnit(unit, actor);
          // Camera or selection refreshes snap coordinates and never count as walks.
          if (!changedRevision && moving && Math.hypot(oldActor.x - actor.x, oldActor.y - actor.y) > 2) { cancelUnitMotion(unit, true); idle(unit); }
          else if (!moving || changedRevision) unit.sprite.setPosition(actor.x, actor.y);
        }
      }
      for (const [id, unit] of units) {
        if (!current.has(id) && !deathIds.has(id) && !unit.dying && !unit.pendingDeath) removeUnit(id);
        else if (deathIds.has(id) && beforeActors.has(id)) {
          unit.pendingDeath = true; unit.actor = beforeActors.get(id);
          unit.sprite.setPosition(unit.actor.x, unit.actor.y); unit.shadow?.setPosition?.(unit.actor.x, unit.actor.y + 2);
        } else if (!current.has(id) && (unit.dying || unit.pendingDeath)) {
          unit.actor = adjusted(unit.actor, snapshot.view);
          unit.sprite.setPosition(unit.actor.x, unit.actor.y); unit.shadow?.setPosition?.(unit.actor.x, unit.actor.y + 2);
        }
      }
    }
    actors.clear(); for (const actor of current.values()) actors.set(actor.id, actor);
    let attackIndex = 0;
    const hasMovement = actions.some(action => action.type === "move");
    if (scene && !failed && !motionReduced && changedRevision) for (const action of actions) {
      if (action.type === "move") for (const actor of current.values()) {
        if (action.fromId && action.fromId !== actor.id) continue;
        const cached = beforeActors.get(actor.id), before = cached && action.from ? Object.assign({}, cached, action.from) : cached;
        if (before && Math.hypot(before.x - actor.x, before.y - actor.y) > 2) moveActor(before, actor);
      }
      if (action.type === "attack" || action.type === "shot") {
        const cached = current.get(action.toId) || beforeActors.get(action.toId), old = beforeActors.get(action.toId);
        const to = cached && action.to ? Object.assign({}, cached, action.to) : cached;
        const damaged = action.damage > 0 || (to?.hp !== null && old?.hp !== null && to?.hp < old?.hp);
        const from = current.get(action.fromId) || beforeActors.get(action.fromId);
        later(() => attack(actors.get(action.fromId) || units.get(action.fromId)?.actor || from,
          actors.get(action.toId) || units.get(action.toId)?.actor || to,
          damaged, deathIds.has(action.toId), action.type === "shot"),
          (hasMovement ? 350 : 0) + attackIndex++ * 300);
      }
    }
    if (charactersReady && !motionReduced && changedRevision) for (const actor of current.values()) {
      const old = beforeActors.get(actor.id), unit = units.get(actor.id);
      if (!unit || old?.hp === null || actor.hp === null || !(actor.hp < old?.hp) ||
        actions.some(action => ["attack", "shot"].includes(action.type) && action.toId === actor.id)) continue;
      // Poison, mission damage and other observed HP losses need no guessed attack.
      later(() => { cancelUnitMotion(unit, true); pose(unit, "hit", () => idle(unit)); }, hasMovement ? 350 : 0);
    }
    lastRevision = snapshot.revision; lastSceneId = snapshot.sceneId; lastView = snapshot.view; publish();
  }
  function sync(snapshot) {
    if (destroyed) return;
    const list = Array.isArray(snapshot?.actions) ? snapshot.actions.slice(0, 24) : [snapshot?.action];
    const clean = { revision: Number.isFinite(snapshot?.revision) ? snapshot.revision : 0,
      sceneId: typeof snapshot?.sceneId === "string" ? snapshot.sceneId.slice(0, 100) : "",
      actors: publicActors(snapshot?.actors), actions: list.map(cleanAction).filter(Boolean), view: cleanView(snapshot?.view) };
    if (!scene && !failed && Phaser) { pending = clean; return; }
    try { apply(clean); } catch (_) { fail(); }
  }
  function resize(size) {
    if (destroyed) return;
    const w = Math.max(1, Math.round(size?.width ?? viewport?.clientWidth ?? 1)), h = Math.max(1, Math.round(size?.height ?? viewport?.clientHeight ?? 1));
    if (w === width && h === height) return;
    width = w; height = h;
    if (scene && game && !failed) { clearEffects(); try { game.scale.resize(width, height); configureCanvas(); } catch (_) { fail(); } }
  }
  function focus(point) {
    if (!scene || destroyed || failed || motionReduced || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
    const g = graphic(), x = point.x, y = point.y, r = 30, arm = 10; g.lineStyle(2, 0xdfc38a, .8);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      g.lineBetween(x + sx * r, y + sy * r, x + sx * (r - arm), y + sy * r);
      g.lineBetween(x + sx * r, y + sy * r, x + sx * r, y + sy * (r - arm));
    }
    tween(g, { alpha: 0, duration: 500 });
  }
  function onMotion(event) {
    motionReduced = !!event.matches;
    if (motionReduced) clearEffects(); else for (const unit of units.values()) idle(unit);
    publish();
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true; media?.removeEventListener?.("change", onMotion); clearEffects();
    for (const id of [...units.keys()]) removeUnit(id);
    game?.destroy?.(true); actors.clear(); pending = null; scene = null; setReady(false); publish();
  }
  function status() {
    return { renderer: destroyed ? "stopped" : failed || !Phaser ? "fallback" : scene ? "phaser" : "loading",
      version: Phaser?.VERSION || null, reducedMotion: motionReduced, moves, attacks, effects: effects.size,
      shots, charactersReady, characters: units.size };
  }
  media?.addEventListener?.("change", onMotion); resize();
  if (Phaser?.Game && host && document?.createElement) {
    try {
      game = new Phaser.Game({ type: Phaser.CANVAS, parent: host, width, height, transparent: true, banner: false,
        audio: { noAudio: true }, input: { mouse: false, touch: false, keyboard: false, gamepad: false },
        fps: { target: 30 }, render: { antialias: true, roundPixels: false }, loader: { imageLoadType: "HTMLImageElement" },
        scene: { preload: function () {
          if (destroyed) return;
          for (const data of sheets.values()) {
            if (data.atlasPath) this.load.atlas(data.key, data.path, data.atlasData || data.atlasPath);
            else this.load.spritesheet(data.key, data.path, { frameWidth: data.frameWidth, frameHeight: data.frameHeight, endFrame: 15 });
          }
        }, create: function () {
          if (destroyed) return;
          scene = this; fitLoadedCanvas(); registerAnimations(); publish();
          if (pending) { const latest = pending; pending = null; apply(latest); }
        } }
      }); configureCanvas();
    } catch (_) { fail(); }
  } else failed = true;
  publish(); return { sync, resize, focus, destroy, status };
});
