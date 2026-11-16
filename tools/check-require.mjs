// Checks the parser build the userscript loads with @require:
//  1. the URL is one Greasy Fork accepts (jsDelivr GitHub URL pinned to a full commit hash);
//  2. the file served there matches the SRI hash in the @require line;
//  3. it is the same parser version as the gunsnprices devDependency the tests use;
//  4. the userscript works with that exact file (one fixture page, in jsdom).
// Needs network access to cdn.jsdelivr.net. Run with: npm run check-require
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const script = readFileSync(new URL("../gunsnprices.user.js", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const line = script.split("\n").find((l) => l.startsWith("// @require "));
const [url, fragment] = line.replace("// @require", "").trim().split("#");
const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};

if (!/^https:\/\/cdn\.jsdelivr\.net\/gh\/[^/]+\/[^/@]+@[a-f0-9]{40}\//.test(url)) fail(`not a commit-pinned jsDelivr URL: ${url}`);
const m = /^sha384-([A-Za-z0-9+/=]+)$/.exec(fragment || "");
if (!m) fail(`no sha384 SRI hash in the @require line: ${fragment}`);

const res = await fetch(url);
if (!res.ok) fail(`${url} returned HTTP ${res.status}`);
const body = Buffer.from(await res.arrayBuffer());
const actual = createHash("sha384").update(body).digest("base64");
if (actual !== m[1]) fail(`SRI mismatch: @require says ${m[1]}, the CDN file is ${actual}`);
console.log(`ok   ${url} (${body.length} bytes) matches sha384-${actual}`);

const banner = /gunsnprices (\d+\.\d+\.\d+)/.exec(body.toString("utf8", 0, 200));
if (!banner || banner[1] !== pkg.devDependencies.gunsnprices) {
  fail(`the build is gunsnprices ${banner && banner[1]}, the tests use ${pkg.devDependencies.gunsnprices}`);
}
console.log(`ok   build is gunsnprices ${banner[1]}, same as the devDependency`);

const html = readFileSync(new URL("../test/fixtures/tractorsupply-listing.html", import.meta.url), "utf8");
const dom = new JSDOM(html, { url: "https://www.tractorsupply.com/tsc/catalog/handgun-ammo", runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window;
let api = null;
w.GM_getValue = (k, d) => d;
w.GM_setValue = () => {};
w.GM_registerMenuCommand = () => 1;
w.GM_info = { gnpTestHook: (x) => (api = x) };
w.eval(`${body.toString("utf8")}\n;\n${script}`); // a userscript manager runs @require'd code and the script in one scope
if (!api) fail("the userscript did not start with the CDN build");
await api.ready;
const found = Array.from(w.document.querySelectorAll("[data-gnp-cpr]")).map((b) => b.textContent).join(" ");
const expected = "$0.34/rd $0.56/rd $0.78/rd $0.40/rd $0.067/rd";
if (found !== expected) fail(`badges with the CDN build: "${found}", expected "${expected}"`);
console.log(`ok   userscript + CDN build: ${found}`);
