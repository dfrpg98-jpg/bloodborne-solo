const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const E = require("../../hunt-engine"), M = require("../../chapter-engine");
const C = require("../../campaigns/long-hunt/data.json"), ED = require("../../enemy-deck");
const G = require("../../tile-geometry");
const root = path.join(__dirname, "../..");
const decode = (value) => String(value).replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

// Only the DOM operations used by the offline controller are implemented. This
// runs its actual click handlers without a browser dependency or engine replay.
class Element {
  constructor(document, tag = "div", attributes = {}) {
    this.document = document; this.tagName = tag; this.attributes = attributes;
    this.dataset = {}; this.style = {}; this.children = []; this.listeners = {};
    this.value = attributes.value || ""; this.checked = "checked" in attributes;
    this.disabled = "disabled" in attributes; this.hidden = "hidden" in attributes;
    this.open = false; this._html = ""; this._text = null;
    this.classList = {
      contains: (name) => (this.attributes.class || "").split(/\s+/).includes(name),
      add: (...names) => { this.attributes.class = [...new Set([...(this.attributes.class || "").split(/\s+/).filter(Boolean), ...names])].join(" "); },
      remove: (...names) => { this.attributes.class = (this.attributes.class || "").split(/\s+/).filter(name => name && !names.includes(name)).join(" "); },
      toggle: (name, force) => { const enabled = force ?? !this.classList.contains(name); enabled ? this.classList.add(name) : this.classList.remove(name); return enabled; },
    };
    for (const [key, value] of Object.entries(attributes)) if (key.startsWith("data-"))
      this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
  }
  set innerHTML(html) {
    for (const child of this.children) if (child.attributes.id && this.document.ids.get(child.attributes.id) === child)
      this.document.ids.delete(child.attributes.id);
    this._html = html; this._text = null; this.children = this.document.parse(html);
  }
  get innerHTML() { return this._html; }
  set textContent(text) { this._text = String(text); }
  get textContent() { return this._text ?? decode(this._html.replace(/<[^>]+>/g, "")); }
  querySelectorAll(selector) {
    const attribute = selector.match(/^\[([^\]]+)\](:checked)?$/);
    if (attribute) return this.children.filter((e) => attribute[1] in e.attributes && (!attribute[2] || e.checked));
    if (selector.startsWith(".")) return this.children.filter((e) => selector.slice(1).split(".").every((c) => (e.attributes.class || "").split(" ").includes(c)));
    return [];
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
  fire(type, properties = {}) {
    const event = { target: this, currentTarget: this, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...properties };
    this["on" + type]?.(event); for (const handler of this.listeners[type] || []) handler(event);
    return event;
  }
  click() { if (!this.disabled) this.fire("click"); }
  getBoundingClientRect() { return { left: 0, right: 0, top: 0, bottom: 0 }; }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  hasAttribute(name) { return name in this.attributes; }
  removeAttribute(name) { delete this.attributes[name]; }
  contains(element) { return element === this || this.children.some(child => child.contains(element)); }
  append(...elements) { this.children.push(...elements); }
  replaceChildren(...elements) { this.children = elements; }
  showModal() { this.open = true; }
  close() { this.open = false; this.fire("close"); }
  focus() { this.document.activeElement = this; }
}
class Document {
  constructor(html) {
    this.ids = new Map(); this.listeners = {}; this.elements = this.parse(html);
    this.body = this.elements.find(element => element.tagName.toLowerCase() === "body");
    this.documentElement = this.elements.find(element => element.tagName.toLowerCase() === "html");
  }
  parse(html) {
    const elements = [];
    for (const match of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
      const attributes = {};
      for (const a of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attributes[a[1]] = decode(a[2] || "");
      const element = new Element(this, match[1], attributes); elements.push(element);
      if (attributes.id) this.ids.set(attributes.id, element);
    }
    for (const match of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
      const element = this.ids.get(match[1]); element._html = match[2];
      const options = [...match[2].matchAll(/<option\b([^>]*)>/g)];
      const chosen = options.find((m) => /\bselected\b/.test(m[1])) || options[0];
      element.value = decode(chosen?.[1].match(/value="([^"]*)"/)?.[1] || "");
    }
    return elements;
  }
  getElementById(id) { return this.ids.get(id) || null; }
  createElement(tag) { return new Element(this, tag); }
  querySelectorAll(selector) {
    const all = new Set(this.elements);
    const visit = element => { all.add(element); for (const child of element.children) visit(child); };
    for (const element of this.ids.values()) visit(element);
    if (selector.startsWith("#")) return [...all].filter(element => element.attributes.id === selector.slice(1));
    const matcher = new Element(this); matcher.children = [...all]; return matcher.querySelectorAll(selector);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
  fire(type, properties = {}) {
    const event = { target: this, currentTarget: this, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...properties };
    for (const handler of this.listeners[type] || []) handler(event); return event;
  }
}
function baseState() { return E.create(90, "burial", 0, null, "hunter-pistol", "center", { campaign: true }); }
function mission(chapter = 1, overrides = {}) {
  return { chapter, insight: 0, won: false, revealed: [1], completed: [],
    fog: [], tokens: [], targets: [], objectives: [], pending: null, ...overrides };
}
function rewards(items = [], overrides = {}) {
  return { rewards: items, choices: [], firearms: [], ...overrides };
}
function boot(state, view = mission(), rewardView = rewards(), options = {}) {
  const document = new Document(fs.readFileSync(path.join(root, "hunt.html"), "utf8"));
  const storage = new Map(Object.entries(options.storage || { "bloodborne-hunt-v07": "fixture" }));
  const commands = [], imports = [], creates = [];
  const engine = { ...E, create: (...args) => { creates.push(args); return structuredClone(state); },
    importSave: (text) => { imports.push(text); return structuredClone(state); },
    exportSave: (s) => JSON.stringify(s), missionView: () => view,
    applyChapelRuling: (s) => s,
    rewardsView: () => rewardView, missionActions: () => options.actions || [],
    interactionEnemies: () => options.interactionEnemies || [],
    provisionalView: () => null,
    dispatch: (s, command) => { commands.push(command); return structuredClone(s); },
    ...options.engine,
  };
  const window = { BBHunt: engine, BBChapter: M, BBLongHunt: C, BBNarrativeText: require("../../campaigns/long-hunt/narrative-text"), BBEnemyDeck: ED, BBTileGeometry: G,
    BBHuntContext: fs.existsSync(path.join(root, "hunt-context.js")) ? require("../../hunt-context") : null,
    BBActualComponents: require("../../actual-components"),
    BBExtendedEnemies: require("../../extended-enemies"),
    BBExtendedFirearms: require("../../extended-firearms"),
    BBRewards: options.rewardDefinitions ? { definitions: options.rewardDefinitions } : require("../../rewards-engine"),
    BBInventory: () => ({ render() {}, clear() {}, ids: () => [], names: () => [] }),
    BBStartPlacement: { mount: (container, select, confirm) => {
      const update = () => { confirm.disabled = !select.value; };
      select.addEventListener("change", update); update(); return { update };
    } },
  };
  const context = vm.createContext({ window, document, localStorage: {
    getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value),
  }, Blob, URL, setTimeout() {}, console });
  if (options.realInventory) vm.runInContext(fs.readFileSync(path.join(root, "inventory.js"), "utf8"), context);
  if (fs.existsSync(path.join(root, "hunt-shell.js"))) vm.runInContext(fs.readFileSync(path.join(root, "hunt-shell.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "hunt-app.js"), "utf8"), context);
  return { document, commands, storage, imports, creates,
    el: (id) => document.getElementById(id),
    buttons: (id) => document.getElementById(id).querySelectorAll("[data-command]"),
  };
}
function option(ui, id, type) { return ui.buttons(id).find((b) => b.dataset.command === type); }


module.exports={boot,Document,Element};
