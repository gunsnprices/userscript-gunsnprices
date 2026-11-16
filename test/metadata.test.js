// Checks of the userscript file itself: Greasy Fork metadata, the pinned @require, readable code, no network code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SCRIPT } from "./helpers.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");

const header = SCRIPT.slice(SCRIPT.indexOf("// ==UserScript=="), SCRIPT.indexOf("// ==/UserScript==") + 18);
const meta = {};
for (const line of header.split("\n")) {
  const m = /^\/\/ @(\S+)\s*(.*)$/.exec(line.trim());
  if (m) (meta[m[1]] ||= []).push(m[2].trim());
}
// the code after the header without comments
const code = SCRIPT.slice(SCRIPT.indexOf("// ==/UserScript==") + 18)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .map((l) => (/^\s*\/\//.test(l) ? "" : l.replace(/\s\/\/ .*$/, "")))
  .join("\n");

// Greasy Fork's pattern for jsDelivr GitHub URLs: a full commit hash is required (https://greasyfork.org/en/help/cdns)
const GF_JSDELIVR_GH = /^(https?:)?\/\/(cdn|test1|testingcf|fastly|gcore)\.jsdelivr\.net\/gh\/[^/]+\/[^/@]+@[a-f0-9]{40}/;

test("has the metadata Greasy Fork needs", () => {
  for (const key of ["name", "namespace", "version", "description", "license", "homepageURL", "supportURL", "match"]) {
    assert.ok(meta[key] && meta[key][0], `@${key} missing`);
  }
  assert.equal(meta.license[0], "MIT");
  assert.equal(meta.homepageURL[0], "https://gunsnprices.com/developers");
  assert.equal(meta.supportURL[0], "https://github.com/gunsnprices/userscript-gunsnprices/issues");
  assert.ok(meta.description[0].length <= 500);
  assert.deepEqual(meta.match, ["*://*/*"]);
  assert.ok(meta.noframes, "@noframes");
  assert.ok(!meta.updateURL && !meta.downloadURL && !meta.installURL, "Greasy Fork strips update URLs; leave them out");
});

test("version matches package.json and the changelog", () => {
  assert.equal(meta.version[0], pkg.version);
  assert.match(changelog, new RegExp(`^## ${pkg.version.replace(/\./g, "\\.")}\\b`, "m"));
});

test("@require is the pinned, integrity-checked parser build", () => {
  assert.equal(meta.require.length, 1);
  const [url, hash] = meta.require[0].split("#");
  assert.match(url, GF_JSDELIVR_GH);
  assert.match(url, /^https:\/\/cdn\.jsdelivr\.net\/gh\/gunsnprices\/bubble-gunsnprices@[a-f0-9]{40}\/dist\/gunsnprices\.min\.js$/);
  // the file's hash itself is compared with the CDN by `npm run check-require`
  assert.match(hash, /^sha384-[A-Za-z0-9+/]{64}$/);
  // the header names the parser version the tests use
  assert.ok(SCRIPT.includes(`gunsnprices npm package ${pkg.devDependencies.gunsnprices} `));
});

test("grants only what the script uses", () => {
  for (const g of meta.grant) {
    const name = g.replace(/^GM\./, "GM.");
    assert.ok(code.includes(name), `@grant ${g} is not used`);
  }
});

test("code is readable, not minified", () => {
  const lines = SCRIPT.split("\n");
  assert.ok(lines.length > 500);
  for (const [i, line] of lines.entries()) {
    if (/^\/\/ @(icon|require) /.test(line)) continue;
    if (/^\s*const [A-Z_]+ = \/.*\/[gimsuy]*;$/.test(line)) continue; // a long regular expression, as in ESLint's max-len
    assert.ok(line.length <= 240, `line ${i + 1} is ${line.length} characters`);
  }
  const nonAscii = Array.from(SCRIPT).filter((c) => (c < " " && !"\t\n\r".includes(c)) || c > "~");
  assert.deepEqual(nonAscii, [], "ASCII only (non-ASCII characters are written as \\u escapes)");
});

test("makes no network requests and runs no dynamic code", () => {
  const forbidden = [
    /\bfetch\s*\(/, /XMLHttpRequest/, /GM_xmlhttpRequest/, /GM\.xmlHttpRequest/, /sendBeacon/, /WebSocket/, /EventSource/,
    /new\s+Image\s*\(/, /\bimport\s*\(/, /\.src\s*=/, /location\.(?:href|assign|replace)\s*[=(]/, /window\.open\s*\(/,
    /\beval\s*\(/, /new\s+Function\s*\(/, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/,
  ];
  for (const re of forbidden) assert.doesNotMatch(code, re, String(re));
  // gunsnprices.com appears in one constant: the panel's credit link (and, when the user turns it on, caliber links)
  assert.equal((code.match(/gunsnprices\.com/g) || []).length, 1);
});

test("no @antifeature: no ads, tracking or referral links", () => {
  assert.equal(meta.antifeature, undefined);
  assert.doesNotMatch(code, /utm_|ref=|affiliate|avantlink|clickid/i);
});
