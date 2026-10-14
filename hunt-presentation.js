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
  const readySheets = new Set(), queuedSheets = new Set(), failedSheets = new Set(), requestedSheets = new Set();
  const standardAnimations = {
    idle: { frames: [0, 1, 2, 3], frameRate: 3, repeat: -1 }, walk: { frames: [4, 5, 6, 7], frameRate: 10, repeat: -1 },
    attack: { frames: [8, 9, 10, 11], frameRate: 14, repeat: 0 }, hit: { frames: [12, 13], frameRate: 8, repeat: 0 },
    death: { frames: [14, 15], frameRate: 5, repeat: 0 }
  };
  for (const [skin, data] of Object.entries(options.characters || {})) {
    if (!/^[a-z][a-z0-9_-]{0,40}$/.test(skin) || !data || typeof data.path !== "string" ||
      !/^assets\/characters\/[a-z0-9_.-]+\.png$/.test(data.path) ||
      !Number.isInteger(data.frameWidth) || !Number.isInteger(data.frameHeight) ||
      data.frameWidth < 16 || data.frameHeight < 16) continue;
    const frameCount = data.frameCount === undefined ? 16 : data.frameCount;
    if (!Number.isInteger(frameCount) || frameCount < 1 || frameCount > 64) continue;
    const animations = cleanAnimations(data.animations, frameCount);
    if (!animations?.idle) continue;
    const atlasData = cleanAtlas(data.atlasData, data.frameWidth, data.frameHeight, frameCount);
    const needsClips = data.atlasData?.frames && Array.from({ length: frameCount }, (_, index) => index)
      .some(index => data.atlasData.frames[String(index)]?.clipRects !== undefined);
    // Invalid clip metadata must not silently fall back to an unmasked sidecar.
    if (needsClips && !atlasData) continue;
    const frameClips = new Map(Object.entries(atlasData?.frames || {}).filter(([, frame]) => frame.clipRects)
      .map(([name, frame]) => [name, frame.clipRects.map(rect => ({ ...rect }))]));
    sheets.set(skin, { key: "bb-character-" + skin, path: data.path, frameCount, animations,
      optional: skin.startsWith("w-") || data.optional === true,
      relatedSkins: Array.isArray(data.relatedSkins) ? data.relatedSkins.slice(0, 4).filter(value => typeof value === "string" && /^[a-z][a-z0-9_-]{0,40}$/.test(value)) : [],
      atlasPath: typeof data.atlasPath === "string" && /^assets\/characters\/[a-z0-9_.-]+\.json$/.test(data.atlasPath) ? data.atlasPath : null,
      atlasData, frameClips, needsClips: frameClips.size > 0,
      frameWidth: data.frameWidth, frameHeight: data.frameHeight,
      // The named boss uses a generously padded 512px atlas. Compensate its
      // transparent canvas without changing the size limits of other actors.
      displayHeight: Number.isFinite(data.displayHeight) ? Math.max(24, Math.min(skin === "cleric-beast" ? 512 : 256, data.displayHeight)) : skin === "boss" ? 104 : 72,
      originY: Number.isFinite(data.originY) ? Math.max(.5, Math.min(1, data.originY)) : .86 });
  }
  let game = null, scene = null, pending = null, destroyed = false, failed = false;
  let latestSnapshot = null, optionalLoading = false, clipSupport = null;
  let lastRevision = null, lastSceneId = null, lastView = null, motionReduced = !!media?.matches;
  let charactersReady = false, moves = 0, attacks = 0, shots = 0, width = 0, height = 0, effectEpoch = 0;

  function cleanAnimations(value, frameCount) {
    const result = {}, source = value && typeof value === "object" ? value : standardAnimations;
    for (const pose of ["idle", "walk", "attack", "attack-0", "attack-1", "attack-2", "hit", "death", "transform"]) {
      const item = source[pose];
      if (!item) continue;
      const frames = Array.isArray(item) ? item : item.frames;
      if (!Array.isArray(frames) || !frames.length || frames.length > 64 ||
        !frames.every(frame => Number.isInteger(frame) && frame >= 0 && frame < frameCount)) continue;
      const frameRate = Number.isFinite(item.frameRate) ? Math.max(1, Math.min(30, item.frameRate)) : pose === "idle" ? 3 : pose === "walk" ? 10 : 14;
      result[pose] = { frames: frames.slice(), frameRate, repeat: pose === "idle" || pose === "walk" ? -1 : 0 };
    }
    return result;
  }
  function cleanAtlas(value, sourceWidth, sourceHeight, frameCount) {
    if (!value || !value.frames || !value.meta?.size) return null;
    const size = value.meta.size;
    const positive = n => Number.isInteger(n) && n > 0 && n <= 8192;
    const nonnegative = n => Number.isInteger(n) && n >= 0 && n <= 8192;
    if (!positive(size.w) || !positive(size.h)) return null;
    const frames = {};
    for (let index = 0; index < frameCount; index++) {
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
      if (item.clipRects !== undefined) {
        const clips = item.clipRects;
        if (!Array.isArray(clips) || !clips.length || clips.length > 2048 || !clips.every(clip => clip &&
          nonnegative(clip.x) && nonnegative(clip.y) && positive(clip.w) && positive(clip.h) &&
          clip.x + clip.w <= sourceWidth && clip.y + clip.h <= sourceHeight)) return null;
        frames[String(index)].clipRects = clips.map(clip => ({ x: clip.x, y: clip.y, w: clip.w, h: clip.h }));
      }
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
        node: typeof a.node === "string" ? a.node.slice(0, 100) : null,
        skin: typeof a.skin === "string" && sheets.has(a.skin) ? a.skin : a.kind === "hunter" ? "hunter" : "mob",
        scale: Number.isFinite(a.scale) ? Math.max(.25, Math.min(4, a.scale)) : 1,
        hp: Number.isFinite(a.hp) ? Math.max(0, a.hp) : null,
        weaponId: typeof a.weaponId === "string" && /^[a-z][a-z0-9_-]{0,40}$/.test(a.weaponId) ? a.weaponId : null,
        weaponFace: a.weaponFace === "a" || a.weaponFace === "b" || a.weaponFace === 0 || a.weaponFace === 1 ? a.weaponFace : null,
        selected: a.selected === true }));
  }
  function cleanPoint(value) {
    return value && Number.isFinite(value.x) && Number.isFinite(value.y) ? { x: value.x, y: value.y } : null;
  }
  function cleanAction(action) {
    if (!action || !["move", "attack", "shot", "transform"].includes(action.type)) return null;
    return { type: action.type, fromId: String(action.fromId || "").slice(0, 100),
      toId: String(action.toId || "").slice(0, 100), from: cleanPoint(action.from), to: cleanPoint(action.to),
      skin: typeof action.skin === "string" && sheets.has(action.skin) ? action.skin : null,
      attackSlot: Number.isInteger(action.attackSlot) && action.attackSlot >= 0 && action.attackSlot <= 2 ? action.attackSlot : null,
      attackStyle: action.attackStyle === "weapon" || action.attackStyle === "other" ? action.attackStyle : null,
      motion: ["slash", "thrust", "sweep", "overhead", "whip", "dual", "claw", "punch", "blast", "shot", "electric", "spirit", "blood"].includes(action.motion) ? action.motion : null,
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
      const hunter = [...actors.values()].find(actor => actor.kind === "hunter");
      host.dataset.presentationWeapon = hunter?.skin || "";
      host.dataset.presentationWeaponReady = hunter && readySheets.has(hunter.skin) ? "true" : "false";
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
    unit.transientSkin = false;
    scene?.tweens?.killTweensOf?.(unit.sprite);
    unit.sprite?.removeAllListeners?.("animationcomplete-" + unit.animation);
    if (snap && unit.actor) unit.sprite?.setPosition?.(unit.actor.x, unit.actor.y);
    unit.moving = false; unit.motion = null;
  }
  function removeUnit(id) {
    const unit = units.get(id);
    if (!unit) return;
    cancelUnitMotion(unit, false); unit.sprite?.anims?.stop?.();
    unit.sprite?.clearMask?.(false); unit.mask?.destroy?.(); unit.maskGraphics?.destroy?.();
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
  function queueSheet(loader, skin) {
    const data = sheets.get(skin);
    if (!data || queuedSheets.has(skin)) return;
    queuedSheets.add(skin);
    if (data.atlasPath) loader.atlas(data.key, data.path, data.atlasData || data.atlasPath);
    else loader.spritesheet(data.key, data.path, { frameWidth: data.frameWidth, frameHeight: data.frameHeight, endFrame: data.frameCount - 1 });
  }
  function requestSkins(snapshot) {
    for (const value of [...snapshot.actors.map(actor => actor.skin), ...snapshot.actions.map(action => action.skin)]) {
      if (!sheets.has(value)) continue;
      requestedSheets.add(value);
      for (const related of sheets.get(value).relatedSkins) if (sheets.has(related)) requestedSheets.add(related);
    }
  }
  function loadRequested() {
    if (!scene || destroyed || failed || optionalLoading) return;
    const batch = [...requestedSheets].filter(skin => sheets.get(skin)?.optional && !queuedSheets.has(skin) && !failedSheets.has(skin));
    if (!batch.length || !scene.load?.start || !scene.load?.once) return;
    optionalLoading = true;
    scene.load.once("complete", () => {
      optionalLoading = false;
      if (destroyed || failed) return;
      try {
        registerAnimations();
        for (const skin of batch) if (!readySheets.has(skin)) failedSheets.add(skin);
        if (latestSnapshot) apply(latestSnapshot);
        if (charactersReady) { try { options.onReady?.(true); } catch (_) { /* Presentation callbacks never change rules. */ } }
        loadRequested(); publish();
      } catch (_) { fail(); }
    });
    for (const skin of batch) queueSheet(scene.load, skin);
    scene.load.start();
  }
  function clippingSupported() {
    if (clipSupport !== null) return clipSupport;
    let graphics, mask;
    try {
      graphics = scene?.make?.graphics?.({ add: false });
      clipSupport = !!graphics && ["clear", "fillRect", "fillStyle", "setPosition", "setScale", "createGeometryMask"]
        .every(name => typeof graphics[name] === "function");
      if (clipSupport) { mask = graphics.createGeometryMask(); clipSupport = !!mask && typeof mask.destroy === "function"; }
    } catch (_) { clipSupport = false; }
    mask?.destroy?.(); graphics?.destroy?.();
    return clipSupport;
  }
  function registerAnimations() {
    if (!scene?.add?.sprite || !scene.anims?.create || !scene.textures?.exists || !sheets.size) return;
    // The original actor set remains an atomic fallback. Optional weapon pairs
    // load independently, so one unavailable portrait cannot hide the map actors.
    const loaded = (skin, data) => {
      const texture = scene.textures.get?.(data.key);
      return queuedSheets.has(skin) && scene.textures.exists(data.key) &&
        (!texture?.has || Array.from({ length: data.frameCount }, (_, index) => index).every(index => texture.has(data.atlasPath ? String(index) : index)));
    };
    if (![...sheets].filter(([, data]) => !data.optional).every(([skin, data]) => loaded(skin, data))) return;
    for (const [skin, data] of sheets) {
      if (!loaded(skin, data) || data.needsClips && !clippingSupported()) continue;
      for (const [name, animation] of Object.entries(data.animations)) {
        const key = animationKey(skin, name), { frames, frameRate, repeat } = animation;
        if (!scene.anims.exists?.(key)) scene.anims.create({ key,
          frames: data.atlasPath ? frames.map(frame => ({ key: data.key, frame: String(frame) })) : scene.anims.generateFrameNumbers(data.key, { frames }),
          frameRate, repeat });
      }
      readySheets.add(skin);
    }
    // Required bodies may load successfully but still need unsupported native
    // clipping. Keep their DOM markers visible until every required body can draw.
    setReady([...sheets].filter(([, data]) => !data.optional).every(([skin]) => readySheets.has(skin)));
  }
  function renderSkin(actor) {
    if (readySheets.has(actor.skin)) return actor.skin;
    const fallback = actor.kind === "hunter" ? "hunter" : "mob";
    return readySheets.has(fallback) ? fallback : null;
  }
  function firstFrame(skin, name = "idle") {
    const data = sheets.get(skin), frame = data?.animations[name]?.frames[0] ?? 0;
    return data?.atlasPath ? String(frame) : frame;
  }
  function applySkinSize(unit) {
    const data = sheets.get(unit.skin);
    if (!data) return;
    const h = data.displayHeight * unit.actor.scale;
    unit.sprite.setDisplaySize?.(h * data.frameWidth / data.frameHeight, h);
    unit.sprite.setOrigin?.(.5, data.originY);
  }
  function updateMask(unit) {
    const data = sheets.get(unit?.skin), sprite = unit?.sprite;
    if (!data || !sprite) return;
    const name = String(typeof sprite.frame === "object" ? sprite.frame?.name : sprite.frame);
    const rects = data.frameClips.get(name);
    if (!rects) {
      if (unit.maskAttached) sprite.clearMask?.(false);
      unit.maskAttached = false; unit.maskFrame = null; return;
    }
    if (!unit.mask) {
      unit.maskGraphics = scene.make.graphics({ add: false });
      unit.mask = unit.maskGraphics.createGeometryMask();
    }
    if (unit.maskFrame !== unit.skin + ":" + name) {
      const graphics = unit.maskGraphics;
      graphics.clear(); graphics.fillStyle(0xffffff, 1);
      for (const rect of rects) graphics.fillRect(rect.x - data.frameWidth * .5,
        rect.y - data.frameHeight * data.originY, rect.w, rect.h);
      unit.maskFrame = unit.skin + ":" + name;
    }
    const sx = Number.isFinite(sprite.scaleX) ? sprite.scaleX : data.displayHeight * unit.actor.scale / data.frameHeight,
      sy = Number.isFinite(sprite.scaleY) ? sprite.scaleY : data.displayHeight * unit.actor.scale / data.frameHeight;
    unit.maskGraphics.setPosition(sprite.x, sprite.y);
    unit.maskGraphics.setScale(sx * (sprite.flipX ? -1 : 1), sy * (sprite.flipY ? -1 : 1));
    unit.maskGraphics.setRotation?.(Number.isFinite(sprite.rotation) ? sprite.rotation : 0);
    if (!unit.maskAttached) { sprite.setMask(unit.mask); unit.maskAttached = true; }
  }
  function safeSpriteSkin(actor, sprite) {
    let skin = renderSkin(actor);
    if (sheets.get(skin)?.needsClips && (typeof sprite.setMask !== "function" || typeof sprite.clearMask !== "function")) {
      // Unsupported masking falls back before any contaminated pose is drawn.
      clipSupport = false;
      for (const [name, data] of sheets) if (data.needsClips) { readySheets.delete(name); failedSheets.add(name); }
      skin = renderSkin(actor);
    }
    return skin;
  }
  function idle(unit) {
    if (!unit || unit.dying || !unit.sprite) return;
    unit.transientSkin = false;
    const skin = renderSkin(unit.actor);
    if (!skin) return;
    if (skin !== unit.skin) {
      unit.skin = skin; unit.sprite.setTexture?.(sheets.get(skin).key, firstFrame(skin));
      applySkinSize(unit);
    }
    unit.animation = animationKey(unit.skin, "idle");
    if (motionReduced) { unit.sprite.anims?.stop?.(); unit.sprite.setFrame?.(firstFrame(unit.skin)); }
    else unit.sprite.play?.(unit.animation, true);
    updateMask(unit);
  }
  function pose(unit, name, complete, requestedSkin) {
    if (!unit || unit.dying || motionReduced) return;
    const currentSkin = renderSkin(unit.actor) || unit.skin;
    const skin = readySheets.has(requestedSkin) ? requestedSkin : currentSkin;
    if (!sheets.get(skin)?.animations[name]) return;
    if (skin !== unit.skin) {
      unit.skin = skin; unit.sprite.setTexture?.(sheets.get(skin).key, firstFrame(skin, name));
      applySkinSize(unit);
    }
    const key = animationKey(skin, name), epoch = ++unit.epoch;
    unit.transientSkin = name.startsWith("attack") && skin !== currentSkin;
    unit.animation = key; unit.sprite.play?.(key);
    updateMask(unit);
    if (complete) unit.sprite.once?.("animationcomplete-" + key, () => {
      if (units.get(unit.actor.id) === unit && unit.epoch === epoch && !unit.dying) complete();
    });
  }
  function updateUnit(unit, actor) {
    const prior = unit.actor; unit.actor = actor;
    // A consumed charge may leave the live equipment uncharged while its
    // already-resolved attack still uses the public pre-attack source form.
    // Camera/selection refreshes preserve that pose until its completion.
    const skin = unit.transientSkin && prior?.skin === actor.skin ? unit.skin : renderSkin(actor), data = sheets.get(skin);
    if (!data) return;
    if (unit.skin !== skin || prior?.skin !== actor.skin) {
      cancelUnitMotion(unit, false); unit.skin = skin; unit.sprite.setTexture?.(data.key, firstFrame(skin)); idle(unit);
    }
    applySkinSize(unit); unit.sprite.setDepth?.(100 + actor.y);
    unit.shadow?.setPosition?.(unit.moving ? unit.sprite.x : actor.x, (unit.moving ? unit.sprite.y : actor.y) + 2);
    unit.shadow?.setScale?.(actor.scale); unit.shadow?.setDepth?.(actor.y);
    updateMask(unit);
  }
  function createUnit(actor) {
    const skin = renderSkin(actor), data = sheets.get(skin);
    if (!data) return null;
    const sprite = scene.add.sprite(actor.x, actor.y, data.key, firstFrame(skin)), shadow = scene.add.graphics();
    shadow.fillStyle?.(0x07080a, .42); shadow.fillEllipse?.(0, 0, actor.skin === "boss" || actor.skin === "cleric-beast" ? 35 : 24, 9);
    const unit = { actor, skin: safeSpriteSkin(actor, sprite), sprite, shadow, epoch: 0, animation: "", moving: false, dying: false,
      pendingDeath: false, transientSkin: false, mask: null, maskGraphics: null, maskAttached: false, maskFrame: null };
    if (unit.skin !== skin) sprite.setTexture?.(sheets.get(unit.skin).key, firstFrame(unit.skin));
    units.set(actor.id, unit);
    sprite.on?.("animationupdate", () => { if (!destroyed && !failed && units.get(actor.id) === unit) {
      try { updateMask(unit); } catch (_) { fail(); }
    } });
    updateUnit(unit, actor); idle(unit); return unit;
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
  function movementDuration(actor) {
    const animation = sheets.get(renderSkin(actor))?.animations.walk;
    // A visible walk finishes one footfall cycle before returning to idle.
    // Keep short/fallback walks readable and bound unusually long optional clips.
    return animation ? Math.max(340, Math.min(600, Math.ceil(animation.frames.length * 1000 / animation.frameRate))) : 340;
  }
  function setUnitPoint(unit, point) {
    unit.sprite.setPosition(point.x, point.y); unit.sprite.setDepth?.(100 + point.y);
    unit.shadow?.setPosition?.(point.x, point.y + 2); updateMask(unit);
  }
  const easedProgress = value => (1 - Math.cos(Math.PI * value)) / 2;
  function observedProgress(unit) {
    const motion = unit.motion, dx = motion.to.x - motion.from.x, dy = motion.to.y - motion.from.y;
    const length = dx * dx + dy * dy;
    if (!length) return motion.progress;
    const fraction = Math.max(0, Math.min(1,
      ((unit.sprite.x - motion.from.x) * dx + (unit.sprite.y - motion.from.y) * dy) / length));
    return Math.acos(1 - 2 * fraction) / Math.PI;
  }
  function runMotionTween(unit, motion, remaining) {
    const epoch = ++unit.epoch, start = motion.progress, easedStart = easedProgress(start);
    scene.tweens.add({ targets: unit.sprite, x: motion.to.x, y: motion.to.y, duration: Math.max(1, remaining),
      ease: start ? value => (easedProgress(start + (1 - start) * value) - easedStart) / (1 - easedStart || 1) : "Sine.easeInOut",
      onUpdate: () => { if (unit.motion !== motion) return; motion.progress = observedProgress(unit);
        unit.shadow?.setPosition?.(unit.sprite.x, unit.sprite.y + 2); unit.sprite.setDepth?.(100 + unit.sprite.y);
        try { updateMask(unit); } catch (_) { fail(); } },
      onComplete: () => { if (unit.epoch === epoch && units.get(unit.actor.id) === unit && unit.motion === motion) {
        setUnitPoint(unit, motion.to); unit.moving = false; unit.motion = null; idle(unit);
      } } });
  }
  function startUnitMotion(unit, from, to, duration, mode) {
    const motion = { from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, duration, mode,
      progress: 0, startedAt: Number.isFinite(scene.time?.now) ? scene.time.now : null };
    unit.moving = true; unit.motion = motion; setUnitPoint(unit, from); runMotionTween(unit, motion, duration);
  }
  function rebaseUnitMotion(unit, actor, nextView) {
    const motion = unit.motion;
    if (!motion) return false;
    const progress = motion.mode === "layout-wait" ? 0 : observedProgress(unit);
    const translate = point => lastView && nextView ? adjusted(point, nextView) :
      { x: point.x + actor.x - motion.to.x, y: point.y + actor.y - motion.to.y };
    const point = translate({ x: unit.sprite.x, y: unit.sprite.y });
    motion.from = translate(motion.from); motion.to = { x: actor.x, y: actor.y };
    motion.progress = progress; setUnitPoint(unit, point);
    if (motion.mode !== "layout-wait") {
      scene.tweens.killTweensOf?.(unit.sprite);
      const elapsed = motion.startedAt !== null && Number.isFinite(scene.time?.now) ? scene.time.now - motion.startedAt : motion.duration * progress;
      runMotionTween(unit, motion, Math.ceil(motion.duration - elapsed));
    }
    return true;
  }
  function cancelForPose(unit) {
    const waiting = unit.motion?.mode === "layout-wait" ? unit.motion : null;
    cancelUnitMotion(unit, !waiting);
    if (waiting) { unit.motion = waiting; unit.moving = true; }
  }
  function moveActor(before, after) {
    const unit = units.get(after.id);
    if (charactersReady && unit) {
      cancelUnitMotion(unit, false); unit.sprite.setPosition(before.x, before.y);
      unit.sprite.setFlipX?.(after.x < before.x); unit.moving = true; pose(unit, "walk");
      startUnitMotion(unit, before, after, movementDuration(after), "walk");
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
    cancelUnitMotion(unit, false); unit.dying = true; unit.pendingDeath = false; unit.animation = animationKey(unit.skin, "death");
    if (sheets.get(unit.skin)?.animations.death) unit.sprite.play?.(unit.animation);
    updateMask(unit); const epoch = unit.epoch;
    scene.tweens.add({ targets: unit.sprite, alpha: 0, duration: 560, delay: 160, ease: "Sine.easeIn",
      onComplete: () => { if (unit.epoch === epoch && units.get(unit.actor.id) === unit) { removeUnit(unit.actor.id); publish(); } } });
  }
  function attackPose(skin, from, action) {
    const animations = sheets.get(skin)?.animations;
    const slotPose = Number.isInteger(action?.attackSlot) ? "attack-" + action.attackSlot : "attack-0";
    return from?.kind === "hunter" && animations?.[slotPose] ? slotPose : "attack";
  }
  function attackPause(from, action) {
    if (from?.kind === "hunter" && action.attackStyle === "other" || action.type === "shot" && action.attackStyle !== "weapon") return 300;
    const skin = action.skin || from?.skin, animation = sheets.get(skin)?.animations[attackPose(skin, from, action)];
    return animation ? Math.max(300, Math.ceil(animation.frames.length * 1000 / animation.frameRate)) : 300;
  }
  function attack(from, to, damaged, defeated, shot, action) {
    if (!to) return;
    const unit = units.get(from?.id), target = units.get(to.id);
    if (unit?.motion?.mode === "layout-wait") from = { ...from, x: unit.sprite.x, y: unit.sprite.y };
    if (target?.motion?.mode === "layout-wait") to = { ...to, x: target.sprite.x, y: target.sprite.y };
    if (unit && (!shot || action?.attackStyle === "weapon") && !(from?.kind === "hunter" && action?.attackStyle === "other")) {
      cancelForPose(unit); unit.sprite.setFlipX?.(to.x < from.x);
      const skin = readySheets.has(action?.skin) ? action.skin : unit.skin;
      pose(unit, attackPose(skin, from, action), () => idle(unit), skin);
    }
    if (target) { if (defeated) defeat(target); else if (damaged) { cancelForPose(target); pose(target, "hit", () => idle(target)); } }
    const g = graphic(), color = from?.kind === "enemy" ? 0xd98370 :
      action?.motion === "electric" ? 0xafcfff : action?.motion === "spirit" ? 0x93c8c5 : action?.motion === "blood" ? 0xca6574 : 0xf4d28c;
    g.lineStyle(shot ? 2 : 3, color, .95);
    if (from && Math.hypot(from.x - to.x, from.y - to.y) > 3) g.lineBetween(from.x, from.y, to.x, to.y);
    if (shot) { if (from) { g.fillStyle(color, .95); g.fillCircle(from.x, from.y - 12, 7); } if (damaged || defeated) g.strokeCircle(to.x, to.y, 12); }
    else if (action?.motion === "thrust" || action?.motion === "punch") {
      g.strokeCircle(to.x, to.y, action.motion === "punch" ? 14 : 10);
      if (from) { g.lineBetween(from.x, from.y - 10, to.x, to.y - 10); g.lineBetween(to.x - 8, to.y - 18, to.x, to.y - 10); g.lineBetween(to.x - 8, to.y - 2, to.x, to.y - 10); }
    } else if (action?.motion === "whip") {
      if (from) {
        const dx = to.x - from.x, dy = to.y - from.y;
        let px = from.x, py = from.y - 10;
        for (let index = 1; index <= 5; index++) {
          const x = from.x + dx * index / 5, y = from.y + dy * index / 5 - 10 + (index % 2 ? -9 : 9);
          g.lineBetween(px, py, x, y); px = x; py = y;
        }
      }
      g.strokeCircle(to.x, to.y, 16);
    } else if (action?.motion === "blast" || action?.motion === "electric" || action?.motion === "spirit") {
      g.strokeCircle(to.x, to.y, 12); g.strokeCircle(to.x, to.y, 24);
      for (let index = 0; index < 6; index++) { const angle = index * Math.PI / 3;
        g.lineBetween(to.x + Math.cos(angle) * 15, to.y + Math.sin(angle) * 15,
          to.x + Math.cos(angle) * 32, to.y + Math.sin(angle) * 32); }
    } else if (action?.motion === "overhead") {
      g.lineBetween(to.x, to.y - 32, to.x, to.y + 14); g.lineBetween(to.x - 16, to.y + 12, to.x + 16, to.y + 12); g.strokeCircle(to.x, to.y, 17);
    } else if (["sweep", "dual", "claw"].includes(action?.motion)) {
      g.strokeCircle(to.x, to.y, 25);
      for (let index = 0; index < (action.motion === "claw" ? 3 : 2); index++)
        g.lineBetween(to.x - 21, to.y + 12 - index * 8, to.x + 21, to.y - 12 - index * 8);
    } else { g.strokeCircle(to.x, to.y, 21); g.lineBetween(to.x - 16, to.y + 14, to.x + 18, to.y - 18); g.lineBetween(to.x - 9, to.y - 17, to.x + 12, to.y + 14); }
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
    return Object.assign({}, actor, { x: (actor.x + lastView.x) * ratio - nextView.x, y: (actor.y + lastView.y) * ratio - nextView.y,
      ...(Number.isFinite(actor.scale) ? { scale: actor.scale * ratio } : {}) });
  }
  function apply(snapshot) {
    latestSnapshot = snapshot; requestSkins(snapshot); loadRequested();
    const current = new Map(snapshot.actors.map(a => [a.id, a]));
    const reset = lastRevision !== null && (snapshot.revision < lastRevision || snapshot.sceneId !== lastSceneId);
    const changedRevision = !reset && lastRevision !== null && snapshot.revision > lastRevision;
    const beforeActors = new Map([...actors].map(([id, a]) => [id, adjusted(a, snapshot.view)]));
    const interrupted = new Map();
    if (changedRevision && !motionReduced) for (const [id, unit] of units) if (unit.moving && unit.motion) {
      const motion = unit.motion, elapsed = motion.startedAt !== null && Number.isFinite(scene.time?.now)
        ? scene.time.now - motion.startedAt : motion.duration * observedProgress(unit);
      interrupted.set(id, { point: adjusted({ x: unit.sprite.x, y: unit.sprite.y }, snapshot.view),
        mode: motion.mode, remaining: Math.max(1, Math.ceil(motion.duration - elapsed)),
        animation: unit.animation, frame: typeof unit.sprite.frame === "object" ? unit.sprite.frame?.name : unit.sprite.frame });
    }
    if (reset || changedRevision) clearEffects();
    if (reset) for (const id of [...units.keys()]) removeUnit(id);
    const actions = changedRevision ? snapshot.actions : [], deathIds = new Set();
    if (!motionReduced) for (const action of actions) if (["attack", "shot"].includes(action.type) && !current.has(action.toId) && beforeActors.has(action.toId)) deathIds.add(action.toId);
    const repacks = [], continuations = [];
    if (charactersReady) {
      for (const actor of current.values()) {
        let unit = units.get(actor.id);
        if (unit?.dying) { removeUnit(actor.id); unit = null; }
        if (!unit) createUnit(actor);
        else {
          const moving = unit.moving, oldActor = unit.actor; updateUnit(unit, actor);
          const previous = beforeActors.get(actor.id), repack = changedRevision && !motionReduced && previous?.node &&
            previous.node === actor.node && Math.hypot(previous.x - actor.x, previous.y - actor.y) > 2 &&
            !actions.some(action => action.type === "move" && (!action.fromId || action.fromId === actor.id));
          const priorMotion = interrupted.get(actor.id), hasMove = actions.some(action => action.type === "move" && (!action.fromId || action.fromId === actor.id));
          if (priorMotion && !hasMove && ["walk", "layout", "layout-wait"].includes(priorMotion.mode)) {
            setUnitPoint(unit, priorMotion.point);
            if (Math.hypot(priorMotion.point.x - actor.x, priorMotion.point.y - actor.y) > .01) {
              if (priorMotion.mode === "walk") {
                unit.animation = animationKey(unit.skin, "walk"); unit.sprite.play?.(unit.animation, true);
                const frames = sheets.get(unit.skin)?.animations.walk?.frames || [];
                unit.sprite.setFrame?.(frames.includes(Number(priorMotion.frame)) ? priorMotion.frame : firstFrame(unit.skin, "walk"));
              }
              startUnitMotion(unit, priorMotion.point, actor, priorMotion.remaining,
                priorMotion.mode === "layout-wait" ? "layout" : priorMotion.mode);
              continuations.push(priorMotion.remaining);
            }
          } else if (repack) {
            unit.moving = true; unit.motion = { mode: "layout-wait", from: previous, to: actor, duration: 240, progress: 0, startedAt: null };
            setUnitPoint(unit, previous); repacks.push(unit);
          } else if (!changedRevision && moving && Math.hypot(oldActor.x - actor.x, oldActor.y - actor.y) > .01) {
            if (!rebaseUnitMotion(unit, actor, snapshot.view)) { cancelUnitMotion(unit, true); idle(unit); }
          } else if (!moving || changedRevision) unit.sprite.setPosition(actor.x, actor.y);
        }
      }
      for (const [id, unit] of units) {
        if (!current.has(id) && !deathIds.has(id) && !unit.dying && !unit.pendingDeath) removeUnit(id);
        else if (deathIds.has(id) && beforeActors.has(id)) {
          unit.pendingDeath = true; unit.actor = beforeActors.get(id);
        } else if (!current.has(id) && (unit.dying || unit.pendingDeath)) {
          unit.actor = adjusted(unit.actor, snapshot.view);
        }
        if (!current.has(id) && (unit.dying || unit.pendingDeath)) {
          applySkinSize(unit); unit.shadow?.setScale?.(unit.actor.scale); setUnitPoint(unit, unit.actor);
        }
      }
    }
    actors.clear(); for (const actor of current.values()) actors.set(actor.id, actor);
    const movingActors = actions.filter(action => action.type === "move").flatMap(action =>
      [...current.values()].filter(actor => !action.fromId || action.fromId === actor.id));
    const repackDelay = repacks.length && !deathIds.size ? 250 : 0,
      movementDelay = Math.max(repackDelay, movingActors.length ? Math.max(...movingActors.map(movementDuration)) + 10 : 0,
        continuations.length ? Math.max(...continuations) + 10 : 0);
    let attackDelay = movementDelay;
    let lastDeathStart = 0;
    if (!deathIds.size) for (const unit of repacks) startUnitMotion(unit, unit.sprite, unit.actor, 240, "layout");
    if (scene && !failed && !motionReduced && changedRevision) for (const action of actions) {
      if (action.type === "move") for (const actor of current.values()) {
        if (action.fromId && action.fromId !== actor.id) continue;
        const cached = beforeActors.get(actor.id), visible = interrupted.get(actor.id)?.point,
          before = cached && visible ? { ...cached, x: visible.x + (action.from ? action.from.x - cached.x : 0),
            y: visible.y + (action.from ? action.from.y - cached.y : 0) } : cached && action.from ? Object.assign({}, cached, action.from) : cached;
        if (before && Math.hypot(before.x - actor.x, before.y - actor.y) > 2) moveActor(before, actor);
      }
      if (action.type === "attack" || action.type === "shot") {
        const cached = current.get(action.toId) || beforeActors.get(action.toId), old = beforeActors.get(action.toId);
        const to = cached && action.to ? Object.assign({}, cached, action.to) : cached;
        const damaged = action.damage > 0 || (to?.hp !== null && old?.hp !== null && to?.hp < old?.hp);
        const from = current.get(action.fromId) || beforeActors.get(action.fromId);
        if (deathIds.has(action.toId)) lastDeathStart = attackDelay;
        later(() => attack(actors.get(action.fromId) || units.get(action.fromId)?.actor || from,
          actors.get(action.toId) || units.get(action.toId)?.actor || to,
          damaged, deathIds.has(action.toId), action.type === "shot", action),
          attackDelay);
        attackDelay += attackPause(from, action);
      }
      if (action.type === "transform") {
        const actor = current.get(action.fromId), old = beforeActors.get(action.fromId), unit = units.get(action.fromId);
        if (unit && actor?.kind === "hunter" && old && (old.skin !== actor.skin || old.weaponFace !== actor.weaponFace)) {
          later(() => { cancelForPose(unit); pose(unit, "transform", () => idle(unit)); }, movementDelay);
        }
      }
    }
    if (charactersReady && !motionReduced && changedRevision) for (const actor of current.values()) {
      const old = beforeActors.get(actor.id), unit = units.get(actor.id);
      if (!unit || old?.hp === null || actor.hp === null || !(actor.hp < old?.hp) ||
        actions.some(action => ["attack", "shot"].includes(action.type) && action.toId === actor.id)) continue;
      // Poison, mission damage and other observed HP losses need no guessed attack.
      later(() => { cancelForPose(unit); pose(unit, "hit", () => idle(unit)); }, movementDelay);
    }
    if (deathIds.size) for (const unit of repacks) later(() => {
      if (units.get(unit.actor.id) === unit && !unit.dying) startUnitMotion(unit, unit.sprite, unit.actor, 240, "layout");
    }, lastDeathStart + 750);
    for (const unit of units.values()) updateMask(unit);
    lastRevision = snapshot.revision; lastSceneId = snapshot.sceneId; lastView = snapshot.view; publish();
  }
  function sync(snapshot) {
    if (destroyed) return;
    const list = Array.isArray(snapshot?.actions) ? snapshot.actions.slice(0, 24) : [snapshot?.action];
    const clean = { revision: Number.isFinite(snapshot?.revision) ? snapshot.revision : 0,
      sceneId: typeof snapshot?.sceneId === "string" ? snapshot.sceneId.slice(0, 100) : "",
      actors: publicActors(snapshot?.actors), actions: list.map(cleanAction).filter(Boolean), view: cleanView(snapshot?.view) };
    requestSkins(clean); latestSnapshot = clean;
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
    game?.destroy?.(true); actors.clear(); pending = null; latestSnapshot = null; scene = null; setReady(false); publish();
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
          for (const [skin, data] of sheets) if (!data.optional || requestedSheets.has(skin)) queueSheet(this.load, skin);
        }, create: function () {
          if (destroyed) return;
          scene = this; fitLoadedCanvas(); registerAnimations(); publish();
          if (pending) { const latest = pending; pending = null; apply(latest); }
        }, update: function () {
          if (destroyed || failed) return;
          try { for (const unit of units.values()) if (unit.maskGraphics || sheets.get(unit.skin)?.needsClips) updateMask(unit); }
          catch (_) { fail(); }
        } }
      }); configureCanvas();
    } catch (_) { fail(); }
  } else failed = true;
  publish(); return { sync, resize, focus, destroy, status };
});
