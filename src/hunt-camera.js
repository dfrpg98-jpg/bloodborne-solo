(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else root.BBHuntCamera = factory;
})(typeof window !== "undefined" ? window : globalThis, function (options) {
  "use strict";
  const { document, viewport, content, surface, onChange } = options;
  if (!viewport || !content || !surface) throw new Error("A map viewport, map content and map surface are required.");
  const minZoom = 0.6, maxZoom = 1.8, step = 1.2, listeners = [];
  let level = clampZoom(options.initialZoom ?? 1), width = 1, height = 1, padX = 0, padY = 0,
    drag = null, lastDrag = 0, destroyed = false;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function clampZoom(value) {
    return Math.max(minZoom, Math.min(maxZoom, Number.isFinite(Number(value)) ? Number(value) : 1));
  }
  function measure() {
    const rect = content.getBoundingClientRect?.();
    width = content.offsetWidth || content.scrollWidth || (rect?.width ? rect.width / level : 1);
    height = content.offsetHeight || content.scrollHeight || (rect?.height ? rect.height / level : 1);
  }
  function notify() {
    if (!destroyed) onChange?.({ zoom: level, left: viewport.scrollLeft || 0, top: viewport.scrollTop || 0 });
  }
  function setPosition(left, top, smooth = false) {
    const bounded = {
      left: clamp(left, 0, Math.max(0, Math.ceil(width * level + padX * 2) - (viewport.clientWidth || 0))),
      top: clamp(top, 0, Math.max(0, Math.ceil(height * level + padY * 2) - (viewport.clientHeight || 0))),
    };
    const reduced = options.reducedMotion?.() ?? document?.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (smooth && !reduced && viewport.scrollTo) viewport.scrollTo({ ...bounded, behavior: "smooth" });
    else { viewport.scrollLeft = bounded.left; viewport.scrollTop = bounded.top; }
    notify();
  }
  function layout({ notify: shouldNotify = true } = {}) {
    if (destroyed) return;
    measure();
    padX = options.padEdges ? (viewport.clientWidth || 0) / 2 : 0;
    padY = options.padEdges ? (viewport.clientHeight || 0) / 2 : 0;
    surface.style.width = `${Math.ceil(width * level + padX * 2)}px`;
    surface.style.height = `${Math.ceil(height * level + padY * 2)}px`;
    content.style.left = `${padX}px`;
    content.style.top = `${padY}px`;
    content.style.transformOrigin = "0 0";
    content.style.transform = `scale(${level})`;
    // Use the scaled surface extent instead of the untransformed element's overflow.
    const left = clamp(viewport.scrollLeft || 0, 0, Math.max(0, Math.ceil(width * level + padX * 2) - (viewport.clientWidth || 0))),
      top = clamp(viewport.scrollTop || 0, 0, Math.max(0, Math.ceil(height * level + padY * 2) - (viewport.clientHeight || 0)));
    viewport.scrollLeft = left; viewport.scrollTop = top;
    if (shouldNotify) notify();
  }
  function setZoom(value, anchor = {}) {
    if (destroyed || !Number.isFinite(Number(value))) return level;
    const next = clampZoom(value), x = anchor.anchorX ?? (viewport.clientWidth || 0) / 2,
      y = anchor.anchorY ?? (viewport.clientHeight || 0) / 2;
    const worldX = ((viewport.scrollLeft || 0) + x - padX) / level,
      worldY = ((viewport.scrollTop || 0) + y - padY) / level;
    level = next;
    layout({ notify: false });
    setPosition(worldX * level + padX - x, worldY * level + padY - y);
    return level;
  }
  function centerOn(element, { smooth = false } = {}) {
    if (destroyed || !element?.getBoundingClientRect || element.isConnected === false) return;
    layout({ notify: false });
    const r = element.getBoundingClientRect(), v = viewport.getBoundingClientRect();
    const x = (r.left + r.right) / 2 - v.left - (viewport.clientLeft || 0),
      y = (r.top + r.bottom) / 2 - v.top - (viewport.clientTop || 0);
    setPosition((viewport.scrollLeft || 0) + x - (viewport.clientWidth || 0) / 2,
      (viewport.scrollTop || 0) + y - (viewport.clientHeight || 0) / 2, smooth);
  }
  function fit() {
    measure();
    return setZoom(Math.min(((viewport.clientWidth || 1) - 24) / width, ((viewport.clientHeight || 1) - 24) / height));
  }
  function listen(target, type, handler, settings) {
    target?.addEventListener?.(type, handler, settings);
    listeners.push(() => target?.removeEventListener?.(type, handler, settings));
  }
  function wheel(event) {
    if (event.defaultPrevented || !(event.ctrlKey || event.metaKey) || !event.deltaY) return;
    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    setZoom(level * Math.exp(-clamp(event.deltaY, -200, 200) * 0.003), {
      anchorX: event.clientX - rect.left - (viewport.clientLeft || 0),
      anchorY: event.clientY - rect.top - (viewport.clientTop || 0),
    });
  }
  function key(event) {
    if (event.defaultPrevented || event.target !== viewport || document?.activeElement !== viewport || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "+" || event.key === "=") { event.preventDefault(); setZoom(level * step); }
    else if (event.key === "-" || event.key === "_") { event.preventDefault(); setZoom(level / step); }
    else if (event.key === "0") { event.preventDefault(); setZoom(1); }
  }
  function pointerDown(event) {
    if (event.defaultPrevented || drag || event.pointerType === "touch" || (event.button !== 0 && event.button !== 1)) return;
    // A target click continues to select that target. Only empty map areas start a pan.
    if (event.target?.closest?.("button, a, input, select, textarea, [role='button'], [data-node], [data-enemy], [data-entrance], [data-command]")) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY,
      left: viewport.scrollLeft || 0, top: viewport.scrollTop || 0, moved: false };
    viewport.focus?.({ preventScroll: true });
    viewport.setPointerCapture?.(event.pointerId);
    viewport.classList?.add("is-panning");
    event.preventDefault();
  }
  function pointerMove(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (drag.moved) { event.preventDefault(); setPosition(drag.left - dx, drag.top - dy); }
  }
  function pointerUp(event) {
    if (!drag || event.pointerId !== drag.id) return;
    if (drag.moved) lastDrag = Date.now();
    if (viewport.hasPointerCapture?.(event.pointerId)) viewport.releasePointerCapture?.(event.pointerId);
    drag = null;
    viewport.classList?.remove("is-panning");
  }
  function suppressPanClick(event) {
    if (lastDrag && Date.now() - lastDrag < 350) { event.preventDefault(); event.stopPropagation(); lastDrag = 0; }
  }
  listen(viewport, "wheel", wheel, { passive: false });
  listen(viewport, "keydown", key);
  listen(viewport, "pointerdown", pointerDown);
  listen(viewport, "pointermove", pointerMove);
  listen(viewport, "pointerup", pointerUp);
  listen(viewport, "pointercancel", pointerUp);
  listen(viewport, "lostpointercapture", pointerUp);
  listen(viewport, "click", suppressPanClick, true);
  listen(viewport, "scroll", notify);
  layout({ notify: false });
  return {
    setZoom, zoomIn: () => setZoom(level * step), zoomOut: () => setZoom(level / step), reset: () => setZoom(1),
    fit, layout, centerOn, zoom: () => level,
    destroy() {
      destroyed = true; drag = null; viewport.classList?.remove("is-panning");
      for (const remove of listeners) remove();
    },
  };
});
