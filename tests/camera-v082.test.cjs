"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), Camera = require("../src/hunt-camera");

function fixture(extra = {}) {
  const document = { activeElement: null }, events = new Map(), notices = [], scrolls = [];
  const viewport = {
    clientWidth: 400, clientHeight: 300, clientLeft: 2, clientTop: 3, scrollLeft: 200, scrollTop: 100,
    style: {}, classList: { classes: new Set(), add(x) { this.classes.add(x); }, remove(x) { this.classes.delete(x); } },
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 404, height: 306, right: 414, bottom: 326 }),
    addEventListener(type, handler, settings) { if (!events.has(type)) events.set(type, []); events.get(type).push({ handler, settings }); },
    removeEventListener(type, handler) { events.set(type, (events.get(type) || []).filter(x => x.handler !== handler)); },
    focus() { document.activeElement = this; },
    setPointerCapture(id) { this.captured = id; }, hasPointerCapture(id) { return this.captured === id; },
    releasePointerCapture(id) { if (this.captured === id) this.captured = null; },
    scrollTo(p) { scrolls.push(p); this.scrollLeft = p.left; this.scrollTop = p.top; },
  };
  const content = { offsetWidth: 1000, offsetHeight: 800, style: {}, getBoundingClientRect() { return { width: this.offsetWidth, height: this.offsetHeight }; } },
    surface = { style: {} }, camera = Camera({ document, viewport, content, surface, onChange: n => notices.push(n), ...extra });
  const target = { closest: () => null };
  function emit(type, args = {}) {
    const event = { target: viewport, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...args };
    for (const { handler } of [...events.get(type) || []]) handler(event);
    return event;
  }
  return { camera, viewport, content, surface, document, notices, scrolls, events, emit, target };
}

test("camera scales only public map content and sizes the clipped scroll surface", () => {
  const f = fixture();
  assert.equal(f.camera.zoom(), 1);
  f.camera.setZoom(0.75);
  assert.equal(f.content.style.transform, "scale(0.75)"); assert.equal(f.content.style.transformOrigin, "0 0");
  assert.equal(f.surface.style.width, "750px"); assert.equal(f.surface.style.height, "600px");
  assert.deepEqual(f.notices.at(-1), { zoom: 0.75, left: 100, top: 37.5 });
});

test("zoom preserves the map point beneath the pointer when away from scroll bounds", () => {
  const f = fixture(), x = 100, y = 120, worldX = (f.viewport.scrollLeft + x) / f.camera.zoom(), worldY = (f.viewport.scrollTop + y) / f.camera.zoom();
  f.camera.setZoom(1.5, { anchorX: x, anchorY: y });
  assert.equal((f.viewport.scrollLeft + x) / f.camera.zoom(), worldX);
  assert.equal((f.viewport.scrollTop + y) / f.camera.zoom(), worldY);
});

test("camera clamps zoom, ignores invalid values and bounds scrolling after shrinking", () => {
  const f = fixture();
  f.camera.setZoom(100); assert.equal(f.camera.zoom(), 1.8);
  const previous = f.notices.length;
  f.camera.setZoom(NaN); f.camera.setZoom("bad"); assert.equal(f.notices.length, previous);
  f.viewport.scrollLeft = 1400; f.viewport.scrollTop = 1140;
  f.camera.setZoom(0.01); assert.equal(f.camera.zoom(), 0.6);
  assert.equal(f.viewport.scrollLeft, 200); assert.equal(f.viewport.scrollTop, 180);
});

test("normal wheel leaves map scrolling alone and modifier wheel anchors at the pointer", () => {
  const f = fixture(), ordinary = f.emit("wheel", { deltaY: 100, clientX: 100, clientY: 140 });
  assert.equal(ordinary.defaultPrevented, undefined); assert.equal(f.camera.zoom(), 1);
  const x = 100 - 10 - 2, y = 140 - 20 - 3, worldX = (200 + x), worldY = (100 + y);
  const wheel = f.emit("wheel", { deltaY: -100, ctrlKey: true, clientX: 100, clientY: 140 });
  assert.equal(wheel.defaultPrevented, true);
  assert(Math.abs((f.viewport.scrollLeft + x) / f.camera.zoom() - worldX) < 1e-10);
  assert(Math.abs((f.viewport.scrollTop + y) / f.camera.zoom() - worldY) < 1e-10);
  assert.equal(f.events.get("wheel")[0].settings.passive, false);
});

test("camera shortcuts require viewport focus and do not steal keys from map buttons or input fields", () => {
  const f = fixture();
  f.emit("keydown", { key: "+" }); assert.equal(f.camera.zoom(), 1);
  f.viewport.focus(); f.emit("keydown", { key: "+", target: {} }); assert.equal(f.camera.zoom(), 1);
  f.emit("keydown", { key: "+", ctrlKey: true }); assert.equal(f.camera.zoom(), 1);
  assert.equal(f.emit("keydown", { key: "+" }).defaultPrevented, true); assert.equal(f.camera.zoom(), 1.2);
  f.emit("keydown", { key: "-" }); assert.equal(f.camera.zoom(), 1);
  f.emit("keydown", { key: "=" }); f.emit("keydown", { key: "0" }); assert.equal(f.camera.zoom(), 1);
});

test("dragging empty map background pans without activating a map target", () => {
  const f = fixture();
  f.emit("pointerdown", { target: f.target, button: 0, pointerId: 4, clientX: 300, clientY: 200 });
  assert.equal(f.document.activeElement, f.viewport); assert(f.viewport.classList.classes.has("is-panning"));
  f.emit("pointermove", { pointerId: 4, clientX: 250, clientY: 160 });
  assert.equal(f.viewport.scrollLeft, 250); assert.equal(f.viewport.scrollTop, 140);
  f.emit("pointerup", { pointerId: 4 });
  assert(!f.viewport.classList.classes.has("is-panning")); assert.equal(f.viewport.captured, null);
  const click = f.emit("click"); assert.equal(click.defaultPrevented, true); assert.equal(click.stopped, true);
  assert.equal(f.emit("click").defaultPrevented, undefined);
});

test("cell, entrance, enemy and control clicks never start a camera drag", () => {
  const f = fixture();
  for (const selector of ["button", "[data-node]", "[data-enemy]", "[data-entrance]", "input"]) {
    let queried = "";
    const event = f.emit("pointerdown", { target: { closest(query) { queried = query; return {}; } }, button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    assert(queried.includes(selector)); assert.equal(event.defaultPrevented, undefined);
    f.emit("pointermove", { pointerId: 1, clientX: 10, clientY: 10 });
    assert.equal(f.viewport.scrollLeft, 200); assert.equal(f.viewport.scrollTop, 100);
  }
});

test("small pointer motion and cancelled pans do not generate movement or target suppression", () => {
  const f = fixture();
  f.emit("pointerdown", { target: f.target, button: 1, pointerId: 2, clientX: 100, clientY: 100 });
  f.emit("pointermove", { pointerId: 99, clientX: 20, clientY: 20 });
  f.emit("pointermove", { pointerId: 2, clientX: 102, clientY: 101 });
  f.emit("pointercancel", { pointerId: 2 });
  assert.equal(f.viewport.scrollLeft, 200); assert.equal(f.viewport.scrollTop, 100);
  assert.equal(f.emit("click").defaultPrevented, undefined); assert(!f.viewport.classList.classes.has("is-panning"));
});

test("touch gestures remain available to native map scrolling", () => {
  const f = fixture();
  const event = f.emit("pointerdown", { target: f.target, pointerType: "touch", button: 0, pointerId: 3, clientX: 100, clientY: 100 });
  assert.equal(event.defaultPrevented, undefined);
  f.emit("pointermove", { pointerId: 3, clientX: 10, clientY: 10 }); assert.equal(f.viewport.scrollLeft, 200);
});

test("layout remeasures rendered dimensions and clamps scroll after content changes", () => {
  const f = fixture();
  f.camera.setZoom(1.5); f.content.offsetWidth = 300; f.content.offsetHeight = 200;
  f.camera.layout();
  assert.equal(f.surface.style.width, "450px"); assert.equal(f.surface.style.height, "300px");
  assert.equal(f.viewport.scrollLeft, 50); assert.equal(f.viewport.scrollTop, 0);
});

test("camera centers visible elements using scaled DOM bounds and respects reduced motion", () => {
  const f = fixture({ reducedMotion: () => true });
  const element = { getBoundingClientRect: () => ({ left: 330, right: 350, top: 250, bottom: 270 }) };
  f.camera.centerOn(element, { smooth: true });
  assert.equal(f.viewport.scrollLeft, 328); assert.equal(f.viewport.scrollTop, 187); assert.equal(f.scrolls.length, 0);
  const g = fixture({ reducedMotion: () => false });
  g.camera.centerOn(element, { smooth: true }); assert.equal(g.scrolls.at(-1).behavior, "smooth");
});

test("fit uses rendered map geometry within zoom limits and reset restores one hundred percent", () => {
  const f = fixture(); f.content.offsetWidth = 500; f.content.offsetHeight = 400;
  f.camera.fit(); assert.equal(f.camera.zoom(), 0.69);
  f.camera.zoomIn(); assert(f.camera.zoom() > 0.69);
  f.camera.zoomOut(); f.camera.reset(); assert.equal(f.camera.zoom(), 1);
  f.content.offsetWidth = 10000; f.camera.fit(); assert.equal(f.camera.zoom(), 0.6);
});

test("destroy removes all listeners and disables subsequent camera actions", () => {
  const f = fixture(); f.camera.destroy();
  assert([...f.events.values()].every(list => list.length === 0));
  f.camera.setZoom(1.5); f.camera.layout(); f.camera.centerOn({ getBoundingClientRect: () => ({}) });
  assert.equal(f.camera.zoom(), 1); assert.equal(f.notices.length, 0);
});

test("edge padding centers border targets even when the rendered world is smaller than the viewport", () => {
  const f = fixture({ padEdges: true });
  f.content.offsetWidth = 200; f.content.offsetHeight = 100; f.camera.layout(); f.camera.setZoom(1.8);
  assert.equal(f.content.style.left, "200px"); assert.equal(f.content.style.top, "150px");
  assert.equal(f.surface.style.width, "760px"); assert.equal(f.surface.style.height, "480px");
  function at(x, y) {
    return { getBoundingClientRect() {
      const px = 10 + 2 + 200 + x * f.camera.zoom() - f.viewport.scrollLeft,
        py = 20 + 3 + 150 + y * f.camera.zoom() - f.viewport.scrollTop;
      return { left: px - 5, right: px + 5, top: py - 5, bottom: py + 5 };
    } };
  }
  f.camera.centerOn(at(0, 0)); assert.equal(f.viewport.scrollLeft, 0); assert.equal(f.viewport.scrollTop, 0);
  f.camera.centerOn(at(200, 100)); assert.equal(f.viewport.scrollLeft, 360); assert.equal(f.viewport.scrollTop, 180);
  f.camera.centerOn(at(100, 50)); assert.equal(f.viewport.scrollLeft, 180); assert.equal(f.viewport.scrollTop, 90);
  const r = at(100, 50).getBoundingClientRect();
  assert.equal((r.left + r.right) / 2, 10 + 2 + 400 / 2);
  assert.equal((r.top + r.bottom) / 2, 20 + 3 + 300 / 2);
});

test("edge padding keeps the pointed world coordinate fixed through zoom and responsive layout", () => {
  const f = fixture({ padEdges: true }), x = 100, y = 120,
    worldX = (f.viewport.scrollLeft + x - 200) / f.camera.zoom(),
    worldY = (f.viewport.scrollTop + y - 150) / f.camera.zoom();
  f.camera.setZoom(1.5, { anchorX: x, anchorY: y });
  assert.equal((f.viewport.scrollLeft + x - 200) / f.camera.zoom(), worldX);
  assert.equal((f.viewport.scrollTop + y - 150) / f.camera.zoom(), worldY);
  const centeredX = f.viewport.scrollLeft / f.camera.zoom(), centeredY = f.viewport.scrollTop / f.camera.zoom();
  f.viewport.clientWidth = 500; f.viewport.clientHeight = 400; f.camera.layout();
  assert.equal(f.content.style.left, "250px"); assert.equal(f.content.style.top, "200px");
  assert.equal(f.surface.style.width, "2000px"); assert.equal(f.surface.style.height, "1600px");
  assert.equal(f.viewport.scrollLeft / f.camera.zoom(), centeredX); assert.equal(f.viewport.scrollTop / f.camera.zoom(), centeredY);
});
