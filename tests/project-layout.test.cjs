"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const root = path.resolve(__dirname, "..");

test("entry pages, secondary pages and styles resolve their local resources after organization", () => {
  const pages = ["index.html", "hunt.html", ...fs.readdirSync(path.join(root, "pages")).filter(p => p.endsWith(".html")).map(p => "pages/" + p)];
  const local = (url, base, owner) => {
    if (/^(?:[a-z]+:|\/|#)/i.test(url)) return;
    const target = path.resolve(base, decodeURIComponent(url.split(/[?#]/)[0]));
    assert.ok(target.startsWith(root + path.sep), owner + ": resource leaves project: " + url);
    assert.ok(fs.existsSync(target), owner + ": missing " + url);
  };
  for (const file of pages) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    const directory = path.dirname(path.join(root, file));
    const baseHref = html.match(/<base\s+href=["']([^"']+)["']/i)?.[1];
    const base = baseHref ? path.resolve(directory, baseHref) : directory;
    for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) {
      if (match[0].startsWith('href="../"')) continue;
      local(match[1], base, file);
    }
  }
  for (const file of fs.readdirSync(path.join(root, "styles")).filter(p => p.endsWith(".css"))) {
    const css = fs.readFileSync(path.join(root, "styles", file), "utf8");
    for (const match of css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) local(match[1], path.join(root, "styles"), file);
  }
});

test("runtime CommonJS references resolve from src without altering content directories", () => {
  for (const file of fs.readdirSync(path.join(root, "src")).filter(p => p.endsWith(".js"))) {
    const source = fs.readFileSync(path.join(root, "src", file), "utf8");
    for (const match of source.matchAll(/require\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g)) {
      assert.doesNotThrow(() => require.resolve(path.resolve(root, "src", match[1])), file + ": " + match[1]);
    }
  }
});
