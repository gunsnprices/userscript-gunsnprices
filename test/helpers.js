// Loads gunsnprices.user.js into a jsdom page the way a userscript manager would: the parser library first
// (the npm package gunsnprices 0.1.2, the same version as the @require'd browser build), stubs for the GM_* API,
// then the script. GM_info.gnpTestHook receives the script's internal functions.
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import * as lib from "gunsnprices";

export const SCRIPT = readFileSync(new URL("../gunsnprices.user.js", import.meta.url), "utf8");

export function fixture(name) {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {string} html page markup
 * @param {string} url page address (decides which adapter applies)
 * @param {{settings?: object, noMenu?: boolean, noLibrary?: boolean, prompt?: string}} [opts]
 */
export async function load(html, url, opts = {}) {
  const dom = new JSDOM(html, { url, runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  const values = new Map();
  if (opts.settings) values.set("settings", JSON.stringify(opts.settings));
  const menu = [];
  const clipboard = [];
  const errors = [];
  let api = null;

  if (!opts.noLibrary) w.GunsNPrices = lib;
  w.GM_getValue = (k, d) => (values.has(k) ? values.get(k) : d);
  w.GM_setValue = (k, v) => values.set(k, v);
  if (!opts.noMenu) {
    w.GM_registerMenuCommand = (name, fn) => menu.push({ name, fn });
    w.GM_unregisterMenuCommand = (id) => {
      menu[id - 1] = null;
    };
  }
  w.GM_setClipboard = (text) => clipboard.push(text);
  w.GM_info = { script: { version: "test" }, gnpTestHook: (x) => (api = x) };
  w.prompt = () => (opts.prompt === undefined ? null : opts.prompt);
  w.addEventListener("error", (e) => errors.push(e.error || e.message));

  w.eval(SCRIPT);
  if (api) await api.ready;
  return {
    dom,
    window: w,
    document: w.document,
    api,
    values,
    errors,
    clipboard,
    menu: () => menu.filter(Boolean),
    savedSettings: () => JSON.parse(values.get("settings") || "{}"),
  };
}

/** Text of every cost-per-round badge, in page order. */
export function badges(document) {
  return Array.from(document.querySelectorAll("[data-gnp-cpr]")).map((b) => b.textContent);
}

/** The badge right after an element, if any. */
export function badgeAfter(el) {
  const next = el && el.nextElementSibling;
  return next && next.hasAttribute("data-gnp-cpr") ? next.textContent : null;
}

/** Select the contents of an element and release the mouse, as a user would. */
export function selectElement(page, el) {
  const { window: w, document: d } = page;
  const range = d.createRange();
  range.selectNodeContents(el);
  const sel = w.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  d.dispatchEvent(new w.MouseEvent("mouseup", { bubbles: true }));
}

export function shadow(page) {
  const ui = page.api.getUi();
  return ui ? ui.root : null;
}
