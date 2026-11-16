// ==UserScript==
// @name         Ammo Cost per Round & Gun Specs (GunsNPrices)
// @namespace    https://gunsnprices.com
// @version      1.0.0
// @description  Select a gun or ammo product title on any page to see caliber, model, magazine capacity, barrel length, rounds per box and cost per round. Optional cost-per-round badges on store pages. Works offline.
// @author       GunsNPrices
// @license      MIT
// @homepageURL  https://gunsnprices.com/developers
// @supportURL   https://github.com/gunsnprices/userscript-gunsnprices/issues
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTIiIGZpbGw9IiMxNDUzMmQiLz48cGF0aCBkPSJNMjUgMjZjMC05IDctMTggNy0xOHM3IDkgNyAxOHoiIGZpbGw9IiNmYmJmMjQiLz48cmVjdCB4PSIyNSIgeT0iMjgiIHdpZHRoPSIxNCIgaGVpZ2h0PSIyMiIgZmlsbD0iI2ZkZTY4YSIvPjxyZWN0IHg9IjIzIiB5PSI1MSIgd2lkdGg9IjE4IiBoZWlnaHQ9IjUiIHJ4PSIxIiBmaWxsPSIjZmRlNjhhIi8+PC9zdmc+
// @match        *://*/*
// @noframes
// @run-at       document-idle
// @require      https://cdn.jsdelivr.net/gh/gunsnprices/bubble-gunsnprices@ff88e1eced061c6513d4f0c0e1de27ff5111b644/dist/gunsnprices.min.js#sha384-fV9e/lO5wkcSkCLr7/lUezpql1fiQDoEOzAvaUlKARmKsSDXWeuHcpunZuy4xxGm
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM.registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM.setClipboard
// ==/UserScript==

/*
 * Gun and ammo title parser for the browser.
 *
 * - Select a product title (with or without its price) on any page and click the small "Specs" button, or use the
 *   "Parse selected title" menu command: a panel shows the caliber, brand and model, magazine capacity, barrel length,
 *   rounds per box and cost per round.
 * - On Tractor Supply and Fleet Farm, and on any other site you turn on from the menu, a small "$0.34/rd" badge is
 *   added next to ammo prices on listing and product pages. Items whose title has no round count, and pages that
 *   already show a per-round price, are left alone.
 *
 * Everything runs in the browser. The script makes no network requests; the only external file is the parser
 * library loaded once by the userscript manager from the @require line above.
 *
 * Parser: the gunsnprices npm package 0.1.2 (https://www.npmjs.com/package/gunsnprices), as the browser build
 * published in https://github.com/gunsnprices/bubble-gunsnprices (dist/gunsnprices.min.js, pinned to a commit and
 * checked with SRI). Code under the MIT license; its model and caliber data under CC BY 4.0, credit
 * GunsNPrices (https://gunsnprices.com).
 *
 * Source, tests and issues: https://github.com/gunsnprices/userscript-gunsnprices
 * Copyright (c) 2026 GunsNPrices. MIT License.
 */

/* global GunsNPrices */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------------------------------------------
  // 0. Library and environment
  // ---------------------------------------------------------------------------------------------------------------

  const lib = typeof GunsNPrices === 'object' && GunsNPrices && typeof GunsNPrices.parseTitle === 'function'
    ? GunsNPrices
    : null;
  if (!lib) return; // the library did not load (blocked CDN, integrity mismatch): do nothing
  if (window.top !== window.self) return;

  // Tests pass a callback through GM_info to get the internal functions. Pages cannot set GM_info.
  const TEST_HOOK = typeof GM_info === 'object' && GM_info && typeof GM_info.gnpTestHook === 'function'
    ? GM_info.gnpTestHook
    : null;
  const hasGM = typeof GM === 'object' && GM !== null;

  const SITE_URL = 'https://gunsnprices.com';
  const BADGE_ATTR = 'data-gnp-cpr';
  const UI_ATTR = 'data-gnp-ui';

  // ---------------------------------------------------------------------------------------------------------------
  // 1. Text helpers: prices, titles, ammo detection
  // ---------------------------------------------------------------------------------------------------------------

  /** fn() or null if it throws: page markup is never trusted to be what the rules expect. */
  function attempt(fn) {
    try {
      return fn();
    } catch (e) {
      return null;
    }
  }

  function norm(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[\s\u00a0\u200b]+/g, ' ').trim();
  }

  // "$18.99", "$ 1,299.99", "US$18", "$18.9"
  const MONEY = /(?:US\s?)?\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?(?!\d)/g;
  // Words right before an amount that make it something other than the price to pay
  const NOT_PRICE_BEFORE = /(?:\bsave|\bsaving|\bsavings|\boff|\bwas|\breg(?:ular)?\.?|\blist(?: price)?|\bmsrp|\bmap|\bcompare(?: at)?|\borig(?:inal)?(?: price)?|\bover|\borders?|\bshipping|\brebate|\breward|\bcredit|\bbonus|\bearn|\bget)\s*:?\s*$/i;
  const NOT_PRICE_AFTER = /^\s*(?:off\b|\/\s*mo\b|per month|a month|rebate|reward|in savings|savings|or more\b|\+\s*(?:shipping|s&h))/i;
  // An amount followed by "/rd", "per round" ... is already a per-round price
  const UNIT_AFTER = /^\s*(?:\/|per\s+|a\s+)\s*(?:rd|rnd|round|shell|shot|cartridge|ct|count)s?\b/i;
  const RANGE_BEFORE = /(?:\bfrom|\bstarting at|\bstarts at|\bas low as)\s*:?\s*$/i;

  /** Every dollar amount in a piece of text, with what surrounds it. */
  function findMoney(text) {
    const s = String(text || '');
    const out = [];
    MONEY.lastIndex = 0;
    let m;
    while ((m = MONEY.exec(s)) !== null) {
      const cents = m[2] ? (m[2].length === 1 ? m[2] + '0' : m[2]) : '00';
      const value = parseFloat(m[1].replace(/,/g, '') + '.' + cents);
      const before = s.slice(Math.max(0, m.index - 24), m.index);
      const after = s.slice(m.index + m[0].length, m.index + m[0].length + 24);
      out.push({
        value,
        start: m.index,
        end: m.index + m[0].length,
        unit: UNIT_AFTER.test(after),
        excluded: NOT_PRICE_BEFORE.test(before) || NOT_PRICE_AFTER.test(after),
        from: RANGE_BEFORE.test(before),
      });
    }
    return out;
  }

  /** The price to pay in a selected piece of text: the lowest amount that is not a saving, an old price or a unit price. */
  function priceFromText(text) {
    const values = findMoney(text).filter((a) => !a.unit && !a.excluded && a.value > 0).map((a) => a.value);
    return values.length ? Math.min.apply(null, values) : null;
  }

  // Lines of a selection that are store UI, not part of the product title
  const NOISE_LINE = /^(?:add to (?:cart|bag|list|wish ?list)|buy now|shop now|view details|quick ?view|compare|select options|choose options|see options|in stock.*|out of stock.*|sold out.*|backorder.*|limit \d+.*|only \d+ left.*|free shipping.*|ships? .*|pick ?up .*|delivery .*|(?:\d(?:\.\d)?\s*(?:out of 5)?\s*)?(?:stars?|reviews?|ratings?)\b.*|\(\d+\)|\d+ reviews?|sku\b.*|item\s*#.*|upc\b.*)$/i;
  const PRICE_WORDS = /\b(?:sale|now|was|reg(?:ular)?|price|msrp|save|you save|our price|list|clearance)\b\s*:?/gi;
  const CPR_FRAGMENTS = /\d+(?:\.\d+)?\s*\u00a2\s*(?:\/|per\s+)?\s*(?:rd|rnd|round)?s?\b|\/\s*(?:rd|rnd|round)s?\b|\bper\s+(?:rd|rnd|round)s?\b|\(\s*\)/gi;

  /** Product title from selected text: UI lines, dollar amounts and per-round fragments removed. */
  function cleanTitle(text) {
    const lines = String(text || '').split(/[\r\n]+/).map(norm).filter((l) => l && !NOISE_LINE.test(l));
    let t = lines.join(' ');
    t = t.replace(MONEY, ' ').replace(CPR_FRAGMENTS, ' ').replace(PRICE_WORDS, ' ').replace(/\(\s*\)|\[\s*\]/g, ' ');
    return norm(t).slice(0, 300);
  }

  // Ammo the library reads as a firearm: shotshells ("25 Shells") and "250 Rd Case" without a bullet weight
  const EXTRA_AMMO = /\b(?:shells?|shotshells?|shot ?shells?|(?:rounds?|rds?|rnds?)\s*(?:per\s*)?(?:box|bx|pack|pk|case|cs|bulk|can|bag|tin)|(?:box|case|pack|can|tin) of \d)\b/i;

  /** parseTitle, plus a second pass as ammo for shotshell and case titles that read like a firearm. */
  function parseSmart(title, opts) {
    const o = opts || {};
    const info = lib.parseTitle(title, o);
    if (!o.kind && info.kind === 'firearm' && !info.model && EXTRA_AMMO.test(title)) {
      const alt = lib.parseTitle(title, Object.assign({}, o, { kind: 'ammo' }));
      if (alt.rounds) return alt;
    }
    return info;
  }

  // Products with a round count in the title that are not ammunition
  const NOT_AMMO = /\b(?:ammo\s+(?:cans?|box(?:es)?|crates?|carriers?|pouch(?:es)?|belts?|trays?|storage|holders?|organizers?|bags?)|dry ?box(?:es)?|holsters?|slings?|speed ?loaders?|loaders?|snap ?caps?|dummy rounds?|training rounds?|primers?|unprimed|brass only|once[- ]fired|powder|reloading|dies|tumbler|bandoliers?|magazines?)\b/i;
  const COMPONENT = /\b(?:bullets?|projectiles?|heads)\b/i;
  const LOADED_AMMO = /\b(?:ammo|ammunition|rounds?|rds?|cartridges?|shells?|loads?)\b/i;
  // Cheap test before parsing: a digit and a word that comes with ammo titles
  const QUICK_AMMO = /\d[\s\S]*(?:rd|rnd|round|box|ct\b|count|pk\b|pack|case|shell|cartridge|ammo|ammunition|gr\b|grain)|(?:rd|rnd|round|box|ct\b|count|pk\b|pack|case|shell|cartridge|ammo|ammunition|gr\b|grain)[\s\S]*\d/i;

  /** Parsed info for a title that is a box of ammunition with a round count, else null. */
  function ammoInfo(title, brand) {
    const t = norm(title);
    if (t.length < 8 || t.length > 300 || !QUICK_AMMO.test(t)) return null;
    if (NOT_AMMO.test(t)) return null;
    if (COMPONENT.test(t) && !LOADED_AMMO.test(t)) return null;
    const info = parseSmart(t, brand ? { brand: brand } : {});
    if (info.kind !== 'ammo' || !info.rounds || info.rounds < 2) return null;
    return info;
  }

  /** Cost per round in a range that makes sense for a box price (2 cents to $30). */
  function plausible(cpr) {
    return typeof cpr === 'number' && isFinite(cpr) && cpr >= 0.02 && cpr <= 30;
  }

  function money(v) {
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatCpr(v) {
    return '$' + v.toFixed(v < 0.1 ? 3 : 2);
  }

  function relevant(info) {
    return !!(info && (info.caliber || info.model || (info.kind === 'ammo' && info.rounds)));
  }

  /** Title, price and parsed info for a piece of selected text. */
  function analyze(text, kind) {
    const title = cleanTitle(text);
    const price = priceFromText(text);
    const info = parseSmart(title, kind ? { kind: kind } : {});
    return { title: title, price: price, priceSource: price ? 'selection' : '', info: info };
  }

  // ---------------------------------------------------------------------------------------------------------------
  // 2. Settings
  // ---------------------------------------------------------------------------------------------------------------

  const DEFAULTS = { selectionButton: true, caliberLinks: false, sites: {} };
  const settings = { selectionButton: true, caliberLinks: false, sites: {} };
  const STORE_KEY = 'settings';

  function readJson(raw) {
    if (raw && typeof raw === 'object') return raw;
    try {
      const v = typeof raw === 'string' ? JSON.parse(raw) : null;
      return v && typeof v === 'object' ? v : {};
    } catch (e) {
      return {};
    }
  }

  async function loadSettings() {
    let raw = null;
    try {
      if (typeof GM_getValue === 'function') raw = GM_getValue(STORE_KEY, null);
      else if (hasGM && typeof GM.getValue === 'function') raw = await GM.getValue(STORE_KEY, null);
    } catch (e) {
      raw = null; // storage unavailable: defaults
    }
    const saved = readJson(raw);
    settings.selectionButton = typeof saved.selectionButton === 'boolean' ? saved.selectionButton : DEFAULTS.selectionButton;
    settings.caliberLinks = typeof saved.caliberLinks === 'boolean' ? saved.caliberLinks : DEFAULTS.caliberLinks;
    settings.sites = saved.sites && typeof saved.sites === 'object' ? saved.sites : {};
  }

  async function saveSettings() {
    const raw = JSON.stringify(settings);
    try {
      if (typeof GM_setValue === 'function') GM_setValue(STORE_KEY, raw);
      else if (hasGM && typeof GM.setValue === 'function') await GM.setValue(STORE_KEY, raw);
    } catch (e) {
      // not saved; the change still applies to this page
    }
  }

  // ---------------------------------------------------------------------------------------------------------------
  // 3. Site adapters
  // ---------------------------------------------------------------------------------------------------------------

  // Stores where the cost-per-round badges are on by default. Both sell ammunition online and put the round count in
  // their ammo titles ("... Handgun Ammunition, 50 Rounds", "... Cartridges - 50 Rounds"). Their pages are read with
  // the generic rules below (a product title and its price inside the same product tile), not with store-specific
  // selectors, so a redesign does not break anything: if the rules find nothing, the page is left as it is.
  // productPath marks product detail pages for the product-page rules.
  const ADAPTERS = [
    { id: 'tractorsupply', name: 'Tractor Supply', hosts: ['tractorsupply.com'], productPath: /^\/tsc\/product\//i },
    { id: 'fleetfarm', name: 'Fleet Farm', hosts: ['fleetfarm.com'], productPath: /^\/detail\//i },
  ];

  function findAdapter(hostname) {
    const h = String(hostname || '').toLowerCase();
    for (const a of ADAPTERS) {
      if (a.hosts.some((d) => h === d || h.endsWith('.' + d))) return a;
    }
    return null;
  }

  const adapter = findAdapter(location.hostname);
  const siteKey = adapter ? adapter.id : String(location.hostname || '').toLowerCase().replace(/^www\./, '');
  const siteName = adapter ? adapter.name : siteKey;

  function badgesWanted() {
    const v = settings.sites[siteKey];
    if (typeof v === 'boolean') return v;
    return !!adapter;
  }

  // Bot checks and error pages: never touch them
  const BOT_TITLE = /just a moment|attention required|access denied|access restricted|security verification|are you a robot|pardon our interruption|request unsuccessful|captcha|^\s*40[345]\b/i;

  function looksBlocked() {
    return BOT_TITLE.test(document.title || '') ||
      !!document.querySelector('#challenge-form, #challenge-running, .cf-turnstile, #px-captcha');
  }

  // ---------------------------------------------------------------------------------------------------------------
  // 4. Prices in the page
  // ---------------------------------------------------------------------------------------------------------------

  // An element whose whole text is one price: "$16.99", "Sale $16.99", "$16.99 each"
  const PRICE_ONLY = /^(?:(?:sale|now|our price|your price|price|special|deal|clearance|only|from|starting at|as low as)\s*:?\s*)?(?:US\s?)?\$\s?(\d{1,3}(?:,\d{3})+|\d{1,6})(?:\.(\d{2}))?\s*(?:each|ea\.?|\/\s*(?:box|bx|ea|each|pk|pack))?$/i;
  const FROM_PRICE = /^(?:from|starting at|as low as)\b/i;
  const SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, SVG: 1, svg: 1, BUTTON: 1, SELECT: 1, OPTION: 1, INPUT: 1, TEXTAREA: 1 };
  // Class words of old prices and of current prices (class names split on - _ and camelCase)
  const HARD_OLD = /\b(?:old|was|strike|struck|strikethrough|crossed|msrp|compare|original|before|previous|oldprice)\b/;
  const SOFT_OLD = /\b(?:regular|reg|list|retail)\b/;
  const SALE_HINT = /\b(?:sale|special|final|current|now|promo|offer|our|deal|discount|member|actual|finalprice)\b/;
  const PER_ROUND_TEXT = /\/\s*(?:rd|rnd|round|shell|cartridge)s?\b|\bper\s+(?:rd|rnd|round|shell|cartridge)s?\b|\u00a2\s*(?:\/|per|each|ea)?\s*(?:rd|rnd|round)s?\b|\bcpr\b|\b(?:cost|price)\s+per\s+(?:rd|round)\b/i;
  const RANGE_TEXT = /\$\s?[\d,]+(?:\.\d{2})?\s*(?:-|\u2013|\u2014|to)\s*\$\s?[\d,]+(?:\.\d{2})?/i;

  function classWords(el) {
    const parts = [
      typeof el.className === 'string' ? el.className : (el.getAttribute && el.getAttribute('class')) || '',
      el.id || '',
      (el.getAttribute && (el.getAttribute('data-price-type') || '')) || '',
      (el.getAttribute && (el.getAttribute('data-testid') || el.getAttribute('data-test') || '')) || '',
      (el.getAttribute && (el.getAttribute('itemprop') || '')) || '',
    ].join(' ');
    return parts.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_:]+/g, ' ').toLowerCase();
  }

  /** Text of an element with superscript cents put back: "$16<sup>99</sup>" gives "$16.99". */
  function priceText(el) {
    let out = '';
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode()) !== null) {
      const t = node.nodeValue || '';
      const parent = node.parentElement;
      const centsBox = parent && parent !== el && (parent.closest('sup') || /\bcents?\b|\bdecimals?\b|\bfraction/i.test(classWords(parent)));
      if (centsBox && /^\s*\d{2}\s*$/.test(t) && /\$\s?[\d,]+$/.test(out.trim())) out = out.trim() + '.' + t.trim();
      else out += t;
    }
    return norm(out);
  }

  function isHidden(el, stop) {
    for (let n = el; n && n !== stop && n.nodeType === 1; n = n.parentElement) {
      if (n.hidden || n.getAttribute('aria-hidden') === 'true') return true;
      const st = window.getComputedStyle ? window.getComputedStyle(n) : null;
      if (st && (st.display === 'none' || st.visibility === 'hidden')) return true;
    }
    return false;
  }

  function lineThrough(el) {
    const st = window.getComputedStyle ? window.getComputedStyle(el) : null;
    const d = st ? String(st.textDecorationLine || st.textDecoration || '') : '';
    return d.indexOf('line-through') >= 0;
  }

  /**
   * How a price element is marked: old (struck, "was"), soft old ("regular"), sale/current, or plain.
   * Only the element and its ancestors inside the tile count; the tile's own classes say nothing about one price.
   */
  function classify(el, stop) {
    let words = '';
    for (let n = el; n && n !== stop && n.nodeType === 1; n = n.parentElement) {
      if (/^(?:DEL|S|STRIKE)$/.test(n.tagName) || lineThrough(n)) return 'old';
      words += ' ' + classWords(n);
    }
    // text right before the price inside its parent: "Was $24.99", "Save $5.00"
    const parent = el.parentElement;
    if (parent && parent !== stop) {
      const pt = norm(parent.textContent);
      const own = norm(el.textContent);
      const i = pt.indexOf(own);
      if (i > 0 && NOT_PRICE_BEFORE.test(pt.slice(Math.max(0, i - 24), i))) return 'old';
      if (i >= 0 && NOT_PRICE_AFTER.test(pt.slice(i + own.length, i + own.length + 24))) return 'old';
    }
    if (HARD_OLD.test(words)) return 'old';
    if (SALE_HINT.test(words)) return 'sale';
    if (SOFT_OLD.test(words)) return 'soft';
    return 'plain';
  }

  /** Price elements inside a product tile or buy box. */
  function priceCandidates(root) {
    const found = [];
    const add = (el, value, text) => {
      if (!(value > 0) || isHidden(el, root)) return;
      found.push({ el: el, outer: el, value: value, text: text, from: FROM_PRICE.test(text) });
    };
    const all = root.querySelectorAll('*');
    for (let i = 0; i < all.length && i < 800; i++) {
      const el = all[i];
      if (SKIP_TAGS[el.tagName] || el.closest('[' + BADGE_ATTR + ']')) continue;
      const raw = el.textContent || '';
      if (raw.length > 80 || raw.indexOf('$') < 0) continue;
      const t = priceText(el);
      if (t.length > 40) continue;
      const m = PRICE_ONLY.exec(t);
      if (!m) continue;
      add(el, parseFloat(m[1].replace(/,/g, '') + '.' + (m[2] || '00')), t);
    }
    // An element inside a price element with another value is a piece of it ("$16" in "$16<sup>99</sup>").
    // Nested elements with the same price: classify by the innermost, place the badge after the outermost.
    const kept = [];
    for (const c of found) {
      if (found.some((o) => o !== c && o.value !== c.value && o.el.contains(c.el))) continue;
      if (found.some((o) => o !== c && o.value === c.value && c.el.contains(o.el))) continue; // an inner one exists
      let outer = c.el;
      for (const o of found) {
        if (o !== c && o.value === c.value && o.el.contains(outer)) outer = o.el;
      }
      c.outer = outer;
      kept.push(c);
    }
    for (const c of kept) c.kind = classify(c.el, root);
    return kept;
  }

  /** The price to pay among a tile's price elements, or null when it is not clear. */
  function choosePrice(cands, preferred) {
    let list = cands.filter((c) => c.kind !== 'old');
    if (!list.length) return null;
    if (list.some((c) => c.from)) return null; // "from $15.99": several pack sizes
    if (preferred) {
      const p = list.find((c) => Math.abs(c.value - preferred) < 0.005);
      if (p) return p;
    }
    const sale = list.filter((c) => c.kind === 'sale');
    if (sale.length) list = sale;
    else if (list.some((c) => c.kind !== 'soft')) list = list.filter((c) => c.kind !== 'soft');
    const values = Array.from(new Set(list.map((c) => c.value)));
    if (values.length > 2) return null;
    const min = Math.min.apply(null, values);
    return list.find((c) => c.value === min) || null;
  }

  function textWithoutBadges(el) {
    let t = el.textContent || '';
    el.querySelectorAll('[' + BADGE_ATTR + ']').forEach((b) => {
      t = t.replace(b.textContent, ' ');
    });
    return t;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // 5. Badges on listing and product pages
  // ---------------------------------------------------------------------------------------------------------------

  const TITLE_SELECTOR = 'a[href], h2, h3, h4, [itemprop="name"], [class*="title"], [class*="Title"], [class*="name"], [class*="Name"]';
  const NAV_SELECTOR = 'nav, [role="navigation"], [role="banner"], [role="contentinfo"], [role="menu"], [role="menubar"], [aria-hidden="true"], [' + UI_ATTR + ']';
  const parseCache = new Map();

  function cachedAmmoInfo(text, brand) {
    const key = text + '\u0000' + (brand || '');
    if (parseCache.has(key)) return parseCache.get(key);
    const info = attempt(() => ammoInfo(text, brand));
    if (parseCache.size > 2000) parseCache.clear();
    parseCache.set(key, info);
    return info;
  }

  /** Elements that hold an ammo title with a round count. */
  function titleCandidates(root) {
    const out = [];
    const els = root.querySelectorAll(TITLE_SELECTOR);
    for (let i = 0; i < els.length && i < 3000 && out.length < 400; i++) {
      const el = els[i];
      if (el.tagName === 'H1' || el.closest('h1') || el.closest(NAV_SELECTOR) || el.closest('[' + BADGE_ATTR + ']')) continue;
      if (el.querySelector('h1')) continue; // a wrapper around the product page title
      const raw = el.textContent || '';
      if (raw.length < 8 || raw.length > 500) continue;
      const text = norm(raw);
      if (text.length < 10 || text.length > 250 || text.indexOf('$') >= 0) continue;
      const info = cachedAmmoInfo(text);
      if (!info) continue;
      out.push({ el: el, text: text, key: text.toLowerCase(), info: info });
    }
    // an anchor and the heading inside it with the same text: keep the inner one
    return out.filter((c) => !out.some((o) => o !== c && o.key === c.key && c.el.contains(o.el)));
  }

  function linkPath(a) {
    try {
      const u = new URL(a.getAttribute('href'), location.href);
      return u.protocol === 'javascript:' ? '' : u.origin + u.pathname.replace(/\/+$/, '');
    } catch (e) {
      return '';
    }
  }

  /** Distinct product links (anchors with a long text) inside a node, the node itself included. */
  function productLinkCount(node) {
    const paths = new Set();
    const list = Array.from(node.querySelectorAll('a[href]'));
    if (node.tagName === 'A' && node.hasAttribute('href')) list.push(node);
    for (const a of list) {
      const t = norm(a.textContent);
      if (t.length < 20 || t.indexOf('$') >= 0) continue;
      const p = linkPath(a);
      if (p) paths.add(p);
      if (paths.size > 1) break;
    }
    return paths.size;
  }

  /** The smallest ancestor of a title that also holds its price, without reaching into other products. */
  function findTile(cand, all) {
    let node = cand.el.parentElement;
    for (let depth = 0; node && node !== document.body && node !== document.documentElement && depth < 8; depth++) {
      if (all.some((o) => o.key !== cand.key && node.contains(o.el))) return null;
      if (productLinkCount(node) > 1) return null;
      const text = node.textContent || '';
      if (text.length > 4000) return null;
      if (text.indexOf('$') >= 0) {
        const cands = priceCandidates(node);
        if (cands.length) return { node: node, cands: cands };
      }
      node = node.parentElement;
    }
    return null;
  }

  const badgeFor = new WeakMap(); // price element -> badge

  function styleBadge(b, block) {
    const s = b.style;
    s.setProperty('display', block ? 'block' : 'inline-block');
    s.setProperty('width', 'auto');
    s.setProperty('margin', block ? '4px 0' : '0 0 0 6px');
    s.setProperty('padding', '1px 6px');
    s.setProperty('border', '1px solid #86efac');
    s.setProperty('border-radius', '9px');
    s.setProperty('background', '#dcfce7');
    s.setProperty('color', '#14532d');
    s.setProperty('font', '600 12px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif');
    s.setProperty('letter-spacing', '0');
    s.setProperty('text-transform', 'none');
    s.setProperty('text-decoration', 'none');
    s.setProperty('white-space', 'nowrap');
    s.setProperty('vertical-align', 'middle');
    if (block) s.setProperty('max-width', 'max-content');
  }

  /** Add or update the badge after a price element. */
  function placeBadge(target, price, rounds, block) {
    const cpr = lib.costPerRound(price, rounds);
    if (!plausible(cpr)) return null;
    const text = formatCpr(cpr) + '/rd';
    const tip = money(price) + ' \u00f7 ' + rounds + ' rounds = ' + formatCpr(cpr) +
      ' per round. Calculated in your browser by the GunsNPrices userscript from the title and price on this page.';
    let b = badgeFor.get(target);
    if (!b || !b.isConnected) {
      const next = target.nextElementSibling;
      b = next && next.hasAttribute(BADGE_ATTR) ? next : null;
    }
    if (!b) {
      b = document.createElement('span');
      b.setAttribute(BADGE_ATTR, '');
      styleBadge(b, block);
      target.insertAdjacentElement('afterend', b);
    }
    if (b.textContent !== text) b.textContent = text;
    if (b.title !== tip) b.title = tip;
    b.setAttribute('aria-label', 'Cost per round ' + formatCpr(cpr));
    badgeFor.set(target, b);
    return b;
  }

  /** Badges for every ammo tile with a title, a round count and one clear price. */
  function scanListing() {
    const titles = titleCandidates(document.body);
    let placed = 0;
    const done = new Set();
    for (const cand of titles) {
      const tile = findTile(cand, titles);
      if (!tile || done.has(tile.node)) continue;
      done.add(tile.node);
      const text = textWithoutBadges(tile.node);
      if (PER_ROUND_TEXT.test(text) || RANGE_TEXT.test(text)) continue; // already shown, or several pack sizes
      const pick = choosePrice(tile.cands);
      if (!pick) continue;
      if (placeBadge(pick.outer, pick.value, cand.info.rounds, false)) placed++;
    }
    return placed;
  }

  function ldTypes(node) {
    const t = node && node['@type'];
    return Array.isArray(t) ? t.map(String) : (t ? [String(t)] : []);
  }

  function collectLd(node, out, depth) {
    if (!node || typeof node !== 'object' || depth > 6) return;
    if (Array.isArray(node)) {
      node.forEach((n) => collectLd(n, out, depth + 1));
      return;
    }
    if (ldTypes(node).some((t) => /^(?:Product|ProductGroup|IndividualProduct)$/i.test(t))) out.push(node);
    for (const k of ['@graph', 'mainEntity']) if (node[k]) collectLd(node[k], out, depth + 1);
  }

  /** The one product described by JSON-LD on the page: name, brand and price (null when it is not one price). */
  function readLdProduct() {
    const products = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try {
        collectLd(JSON.parse(s.textContent), products, 0);
      } catch (e) {
        // broken JSON-LD
      }
    });
    const names = Array.from(new Set(products.map((p) => norm(p.name)).filter(Boolean)));
    if (names.length !== 1) return null;
    const p = products.find((x) => norm(x.name) === names[0]);
    const offers = [];
    products.forEach((x) => {
      const o = x.offers;
      (Array.isArray(o) ? o : (o ? [o] : [])).forEach((y) => {
        if (y && typeof y === 'object') offers.push(y);
      });
    });
    const prices = new Set();
    offers.forEach((o) => {
      if (o.priceCurrency && o.priceCurrency !== 'USD') return;
      if (o.price !== undefined) prices.add(parseFloat(String(o.price).replace(/[^0-9.]/g, '')));
      else if (o.lowPrice !== undefined && String(o.lowPrice) === String(o.highPrice || o.lowPrice)) {
        prices.add(parseFloat(String(o.lowPrice).replace(/[^0-9.]/g, '')));
      }
    });
    const list = Array.from(prices).filter((v) => v > 0);
    const brand = p.brand && typeof p.brand === 'object' ? p.brand.name : p.brand;
    return {
      name: names[0],
      brand: typeof brand === 'string' ? brand : '',
      price: list.length === 1 ? list[0] : null,
      priceCount: list.length,
    };
  }

  function isProductPage() {
    if (adapter && adapter.productPath && adapter.productPath.test(location.pathname)) return true;
    const og = document.querySelector('meta[property="og:type"]');
    if (og && /product/i.test(og.getAttribute('content') || '')) return true;
    return !!document.querySelector('script[type="application/ld+json"]') && !!readLdProduct();
  }

  /** Badge next to the main price of a product page whose title is an ammo box with a round count. */
  function scanProduct() {
    if (!isProductPage()) return 0;
    const ld = readLdProduct();
    // several prices in the structured data: several pack sizes, and the title names only one of them
    if (ld && ld.priceCount > 1) return 0;
    let h1 = Array.from(document.querySelectorAll('h1')).find((h) => norm(h.textContent) && !isHidden(h, null)) || null;
    let title = norm((h1 && h1.textContent) || (ld && ld.name) || '');
    let info = title ? cachedAmmoInfo(title, ld && ld.brand) : null;
    if (!info && ld && ld.name && norm(ld.name) !== title) {
      // the <h1> is something else (a logo, a category): use the element that shows the JSON-LD name
      title = norm(ld.name);
      info = cachedAmmoInfo(title, ld.brand);
      h1 = Array.from(document.querySelectorAll('h1, h2, [itemprop="name"]')).find((e) => norm(e.textContent) === title) || null;
    }
    if (!info) return 0;
    // titles of other products (related items, carousels): the search for the price stops before reaching them
    const key = title.toLowerCase();
    const others = titleCandidates(document.body).filter((c) => c.key !== key && (!h1 || (!h1.contains(c.el) && !c.el.contains(h1))));
    let pick = null;
    let area = null;
    if (h1) {
      let node = h1.parentElement;
      for (let depth = 0; node && node !== document.documentElement && depth < 6; depth++) {
        if ((node.textContent || '').length > 8000) break;
        if (others.some((o) => node.contains(o.el))) break;
        const cands = priceCandidates(node);
        if (cands.length) {
          area = node;
          pick = choosePrice(cands, ld && ld.price);
          break;
        }
        node = node.parentElement;
      }
    }
    if (area && PER_ROUND_TEXT.test(textWithoutBadges(area))) return 0;
    if (area && !pick) return 0; // prices next to the title, but not one clear price
    if (pick) return placeBadge(pick.outer, pick.value, info.rounds, false) ? 1 : 0;
    if (ld && ld.price && h1) return placeBadge(h1, ld.price, info.rounds, true) ? 1 : 0;
    return 0;
  }

  function runScan() {
    let n = 0;
    try {
      n += scanListing();
    } catch (e) {
      // a layout these rules do not understand: leave the page as it is
    }
    try {
      n += scanProduct();
    } catch (e) {
      // same
    }
    return n;
  }

  let observer = null;
  let scanTimer = 0;
  let lastScan = 0;

  function isOurs(node) {
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    return !!(el && el.closest && (el.closest('[' + BADGE_ATTR + ']') || el.closest('[' + UI_ATTR + ']')));
  }

  function onMutations(records) {
    for (const r of records) {
      if (isOurs(r.target)) continue;
      const nodes = Array.from(r.addedNodes).concat(Array.from(r.removedNodes));
      if (r.type === 'childList' && nodes.length && nodes.every((n) => n.nodeType === 1 && (n.hasAttribute(BADGE_ATTR) || n.hasAttribute(UI_ATTR)))) continue;
      scheduleScan();
      return;
    }
  }

  function scheduleScan() {
    if (scanTimer) return;
    const wait = Math.max(600, 1500 - (Date.now() - lastScan));
    scanTimer = setTimeout(() => {
      scanTimer = 0;
      lastScan = Date.now();
      runScan();
    }, wait);
  }

  function startBadges() {
    if (observer || !document.body || looksBlocked()) return;
    lastScan = Date.now();
    runScan();
    observer = new MutationObserver(onMutations);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function stopBadges() {
    if (observer) observer.disconnect();
    observer = null;
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = 0;
    document.querySelectorAll('[' + BADGE_ATTR + ']').forEach((b) => b.remove());
  }

  // ---------------------------------------------------------------------------------------------------------------
  // 6. Panel, selection button and messages (shadow DOM, so page styles do not leak in)
  // ---------------------------------------------------------------------------------------------------------------

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .wrap { font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1f2937; }
    .btn { position: fixed; z-index: 2147483647; display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px;
      border: 1px solid #14532d; border-radius: 999px; background: #14532d; color: #fff; font: 600 12px/1.6 inherit;
      font-family: inherit; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
    .btn:hover { background: #166534; }
    .panel { position: fixed; z-index: 2147483647; top: 16px; right: 16px; width: 340px; max-width: calc(100vw - 32px);
      max-height: calc(100vh - 32px); overflow: auto; background: #fff; color: #1f2937; border: 1px solid #d1d5db;
      border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.25); padding: 12px 14px; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
    .head strong { font-size: 14px; }
    .x { border: 0; background: transparent; font-size: 20px; line-height: 1; cursor: pointer; color: #6b7280; padding: 0 2px; }
    .title { font-size: 12px; color: #4b5563; margin-bottom: 8px; word-break: break-word; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 3px 12px; margin: 0 0 8px; }
    dt { color: #6b7280; }
    dd { margin: 0; font-weight: 600; word-break: break-word; }
    .none { color: #6b7280; margin: 0 0 8px; }
    .calc { border-top: 1px solid #e5e7eb; padding-top: 8px; margin-bottom: 8px; }
    .calc label { display: inline-flex; align-items: center; gap: 4px; margin-right: 10px; color: #6b7280; }
    .calc input { width: 84px; padding: 2px 6px; border: 1px solid #d1d5db; border-radius: 6px; font: inherit; color: #1f2937; background: #fff; }
    .cpr { margin-top: 6px; font-size: 16px; font-weight: 700; color: #14532d; }
    .hint { font-size: 12px; color: #6b7280; }
    select { font: inherit; padding: 1px 4px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; color: #1f2937; }
    .actions { display: flex; gap: 8px; margin-bottom: 8px; }
    .actions button { font: inherit; font-size: 12px; padding: 3px 10px; border: 1px solid #d1d5db; border-radius: 6px; background: #f9fafb; color: #1f2937; cursor: pointer; }
    details { border-top: 1px solid #e5e7eb; padding-top: 6px; margin-bottom: 6px; font-size: 12px; }
    summary { cursor: pointer; color: #374151; }
    details label { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
    .foot { font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 6px; }
    a { color: #166534; }
    .toast { position: fixed; z-index: 2147483647; right: 16px; bottom: 16px; max-width: 320px; padding: 8px 12px;
      background: #111827; color: #fff; border-radius: 8px; font-size: 13px; box-shadow: 0 4px 14px rgba(0,0,0,.3); }
  `;

  let ui = null;
  let current = null; // analysis shown in the panel
  let toastTimer = 0;
  let buttonTimer = 0;

  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        if (k === 'text') el.textContent = attrs[k];
        else if (k === 'on') Object.keys(attrs.on).forEach((ev) => el.addEventListener(ev, attrs.on[ev]));
        else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) el.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
      }
    }
    (children || []).forEach((c) => {
      if (c !== null && c !== undefined && c !== false) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  function ensureUi() {
    if (ui && ui.host.isConnected) return ui;
    const host = document.createElement('div');
    host.setAttribute(UI_ATTR, '');
    ['position:fixed', 'top:0', 'left:0', 'width:0', 'height:0', 'z-index:2147483647'].forEach((p) => {
      const i = p.indexOf(':');
      host.style.setProperty(p.slice(0, i), p.slice(i + 1));
    });
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);
    try {
      // also works under a strict style-src Content Security Policy
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
      root.adoptedStyleSheets = [sheet];
    } catch (e) {
      // the <style> element above is enough on most pages
    }
    const wrap = h('div', { class: 'wrap' });
    root.appendChild(wrap);
    document.documentElement.appendChild(host);
    ui = { host: host, root: root, wrap: wrap, button: null, panel: null, toast: null };
    return ui;
  }

  function toast(message) {
    const u = ensureUi();
    if (u.toast) u.toast.remove();
    u.toast = h('div', { class: 'toast', role: 'status', text: message });
    u.wrap.appendChild(u.toast);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (u.toast) u.toast.remove();
      u.toast = null;
    }, 3000);
  }

  function hideButton() {
    clearTimeout(buttonTimer);
    if (ui && ui.button) {
      ui.button.remove();
      ui.button = null;
    }
  }

  function showButton(rect, analysis) {
    const u = ensureUi();
    hideButton();
    const btn = h('button', { class: 'btn', type: 'button', title: 'Show specs and cost per round (GunsNPrices)', text: 'Specs' });
    btn.addEventListener('mousedown', (e) => e.preventDefault()); // keep the selection
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideButton();
      openPanel(analysis);
    });
    const vw = window.innerWidth || 1024;
    const vh = window.innerHeight || 768;
    const top = Math.min(Math.max(4, (rect.bottom || 0) + 6), vh - 30);
    const left = Math.min(Math.max(4, (rect.right || 0) - 60), vw - 80);
    btn.style.setProperty('top', top + 'px');
    btn.style.setProperty('left', left + 'px');
    u.wrap.appendChild(btn);
    u.button = btn;
    buttonTimer = setTimeout(hideButton, 8000);
  }

  function closePanel() {
    if (ui && ui.panel) {
      ui.panel.remove();
      ui.panel = null;
    }
    current = null;
  }

  function caliberNode(c) {
    const label = c.name + (c.type ? ' (' + c.type + ')' : '');
    if (settings.caliberLinks && c.url && c.url.indexOf(SITE_URL + '/') === 0) {
      return h('a', { href: c.url, target: '_blank', rel: 'noopener', title: 'Price comparison for ' + c.name + ' on GunsNPrices', text: label });
    }
    return document.createTextNode(label);
  }

  function specRows(info) {
    const rows = [];
    const add = (label, value) => {
      if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) return;
      rows.push(h('dt', { text: label }));
      rows.push(h('dd', null, [typeof value === 'string' ? value : value]));
    };
    const m = info.model;
    add('Brand', info.brand || (m && m.brand) || '');
    if (m) {
      add('Model', m.model);
      if (m.family && m.family !== m.model) add('Family', m.family);
      add('Generation', m.generation);
      add('Configuration', (m.configs || []).join(', '));
      add('Features', (m.features || []).join(', '));
    }
    if (info.calibers && info.calibers.length) {
      const dd = h('span');
      info.calibers.forEach((c, i) => {
        if (i) dd.appendChild(document.createTextNode(', '));
        dd.appendChild(caliberNode(c));
      });
      add(info.calibers.length > 1 ? 'Calibers' : 'Caliber', dd);
    }
    if (info.kind === 'firearm') {
      if (info.capacity) add('Capacity', info.capacity + ' rounds');
      if (info.barrelLength) add('Barrel', info.barrelLength + ' in');
    }
    return rows;
  }

  function renderPanel() {
    const u = ensureUi();
    const a = current;
    const info = a.info;
    const body = [];
    body.push(h('div', { class: 'head' }, [
      h('strong', { text: 'Gun & ammo specs' }),
      h('button', { class: 'x', type: 'button', 'aria-label': 'Close', title: 'Close (Esc)', text: '\u00d7', on: { click: closePanel } }),
    ]));
    body.push(h('div', { class: 'title', text: a.title || '(no title text)' }));

    const kindSelect = h('select', { 'aria-label': 'Type', on: { change: (e) => {
      const kind = e.target.value;
      current = Object.assign({}, current, { info: parseSmart(current.title, { kind: kind }), kind: kind });
      renderPanel();
    } } }, [
      h('option', { value: 'ammo', text: 'Ammunition', selected: info.kind === 'ammo' }),
      h('option', { value: 'firearm', text: 'Firearm', selected: info.kind === 'firearm' }),
    ]);
    const rows = [h('dt', { text: 'Type' }), h('dd', null, [kindSelect])].concat(specRows(info));
    body.push(h('dl', null, rows));
    if (!relevant(info)) body.push(h('p', { class: 'none', text: 'No caliber, model or round count found in this text.' }));

    if (info.kind === 'ammo') {
      const priceInput = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': 'Price in dollars', value: a.price ? a.price.toFixed(2) : '' });
      const roundsInput = h('input', { type: 'text', inputmode: 'numeric', 'aria-label': 'Rounds per box', value: info.rounds ? String(info.rounds) : '' });
      const out = h('div', { class: 'cpr' });
      const note = h('div', { class: 'hint' });
      const update = () => {
        const price = parseFloat(String(priceInput.value).replace(/[^0-9.]/g, ''));
        const rounds = parseInt(String(roundsInput.value).replace(/[^0-9]/g, ''), 10);
        const cpr = price > 0 && rounds > 0 ? lib.costPerRound(price, rounds) : null;
        out.textContent = cpr ? formatCpr(cpr) + ' per round (' + (cpr * 100).toFixed(1) + '\u00a2)' : 'Cost per round: enter a price' + (rounds > 0 ? '' : ' and a round count');
        note.textContent = a.priceSource === 'page' && String(priceInput.value) === a.price.toFixed(2)
          ? 'Price found next to the selection; check that it belongs to this item.'
          : '';
      };
      priceInput.addEventListener('input', update);
      roundsInput.addEventListener('input', update);
      body.push(h('div', { class: 'calc' }, [
        h('label', null, ['Price $', priceInput]),
        h('label', null, ['Rounds', roundsInput]),
        out,
        note,
      ]));
      update();
    }

    const copyBtn = h('button', { type: 'button', text: 'Copy as JSON', on: { click: () => {
      const data = Object.assign({ price: a.price || null }, current.info);
      copyText(JSON.stringify(data, null, 2)).then((ok) => toast(ok ? 'Copied.' : 'Could not copy.'));
    } } });
    body.push(h('div', { class: 'actions' }, [copyBtn]));

    const check = (label, checked, onChange, disabled) => {
      const box = h('input', { type: 'checkbox', checked: checked, disabled: disabled, on: { change: (e) => onChange(e.target.checked) } });
      return h('label', null, [box, label]);
    };
    body.push(h('details', null, [
      h('summary', { text: 'Settings' }),
      check('Cost-per-round badges on ' + siteName, badgesWanted(), (v) => setBadges(v)),
      check('"Specs" button when I select a gun or ammo title', settings.selectionButton, (v) => setSelectionButton(v), !menuAvailable()),
      check('Link calibers to their GunsNPrices price comparison page', settings.caliberLinks, (v) => setCaliberLinks(v)),
    ]));

    body.push(h('div', { class: 'foot' }, [
      'Runs in your browser; nothing is sent anywhere. Parser and data: ',
      h('a', { href: SITE_URL, target: '_blank', rel: 'noopener', text: 'GunsNPrices' }),
      ' (code MIT, data CC BY 4.0).',
    ]));

    const panel = h('div', { class: 'panel', role: 'dialog', 'aria-label': 'Gun and ammo specs' }, body);
    if (u.panel) u.panel.replaceWith(panel);
    else u.wrap.appendChild(panel);
    u.panel = panel;
  }

  function openPanel(analysis) {
    current = analysis;
    renderPanel();
  }

  async function copyText(text) {
    try {
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(text, 'text');
        return true;
      }
      if (hasGM && typeof GM.setClipboard === 'function') {
        await GM.setClipboard(text);
        return true;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {
      // fall through
    }
    return false;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // 7. Selection
  // ---------------------------------------------------------------------------------------------------------------

  function editing() {
    const a = document.activeElement;
    return !!(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable));
  }

  function selectionRect(range) {
    try {
      if (typeof range.getBoundingClientRect === 'function') return range.getBoundingClientRect();
    } catch (e) {
      // no layout information
    }
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  /** A price shown next to the selected title, when the selection has none. */
  function priceNear(range) {
    let node = range.commonAncestorContainer;
    if (node && node.nodeType !== 1) node = node.parentElement;
    for (let depth = 0; node && node !== document.body && depth < 5; depth++) {
      if ((node.textContent || '').length > 3000 || productLinkCount(node) > 1) break;
      if ((node.textContent || '').indexOf('$') >= 0) {
        const cands = priceCandidates(node);
        if (cands.length) {
          const pick = choosePrice(cands);
          return pick ? pick.value : null;
        }
      }
      node = node.parentElement;
    }
    return null;
  }

  /** Analysis of the current selection, or null when nothing is selected. */
  function readSelection() {
    const sel = window.getSelection ? window.getSelection() : null;
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const text = sel.toString();
    if (!norm(text)) return null;
    const range = sel.getRangeAt(0);
    const a = analyze(text);
    if (!a.price && a.info.kind === 'ammo') {
      try {
        const p = priceNear(range);
        if (p) {
          a.price = p;
          a.priceSource = 'page';
        }
      } catch (e) {
        // no price
      }
    }
    a.rect = selectionRect(range);
    return a;
  }

  function checkSelection() {
    if (!settings.selectionButton || editing()) return hideButton();
    const sel = window.getSelection ? window.getSelection() : null;
    if (!sel || sel.isCollapsed || !sel.rangeCount) return hideButton();
    const text = sel.toString();
    if (text.length < 6 || text.length > 400 || !/\d/.test(text) || (text.match(/\n/g) || []).length > 6) return hideButton();
    const a = attempt(readSelection);
    if (!a || !relevant(a.info)) return hideButton();
    showButton(a.rect, a);
  }

  function onPointerUp(e) {
    if (ui && e && typeof e.composedPath === 'function' && e.composedPath().indexOf(ui.host) >= 0) return;
    setTimeout(checkSelection, 10);
  }

  function onKeyUp(e) {
    if (e.key === 'Escape') {
      hideButton();
      closePanel();
    } else if (e.shiftKey && /^(?:Arrow|Home|End)/.test(e.key)) {
      setTimeout(checkSelection, 10);
    }
  }

  // ---------------------------------------------------------------------------------------------------------------
  // 8. Menu commands and settings changes
  // ---------------------------------------------------------------------------------------------------------------

  const menuIds = [];

  function registerFn() {
    if (typeof GM_registerMenuCommand === 'function') return GM_registerMenuCommand;
    if (hasGM && typeof GM.registerMenuCommand === 'function') return GM.registerMenuCommand.bind(GM);
    return null;
  }

  function menuAvailable() {
    return !!registerFn();
  }

  function onOff(v) {
    return v ? 'on' : 'off';
  }

  function registerMenu() {
    const reg = registerFn();
    if (!reg) return false;
    const canRelabel = typeof GM_unregisterMenuCommand === 'function';
    if (menuIds.length) {
      if (!canRelabel) return true; // labels stay as first registered
      menuIds.splice(0).forEach((id) => {
        try {
          GM_unregisterMenuCommand(id);
        } catch (e) {
          // ignore
        }
      });
    }
    const label = (text, value) => text + (canRelabel ? ': ' + onOff(value) : ' (on/off)');
    const add = (text, fn) => {
      try {
        const id = reg(text, fn);
        menuIds.push(id);
      } catch (e) {
        // ignore
      }
    };
    add('Parse selected title\u2026', cmdParse);
    add(label('Cost-per-round badges on ' + siteName, badgesWanted()), () => setBadges(!badgesWanted()));
    add(label('"Specs" button on selection', settings.selectionButton), () => setSelectionButton(!settings.selectionButton));
    add(label('Caliber links in the panel', settings.caliberLinks), () => setCaliberLinks(!settings.caliberLinks));
    return true;
  }

  function cmdParse() {
    let a = attempt(readSelection);
    if (!a) {
      const text = window.prompt('Paste a gun or ammo product title. A price such as $18.99 is optional.', '');
      if (!text || !norm(text)) return;
      a = analyze(text);
    }
    hideButton();
    openPanel(a);
  }

  async function setBadges(on) {
    settings.sites[siteKey] = !!on;
    await saveSettings();
    if (on) startBadges();
    else stopBadges();
    registerMenu();
    if (current) renderPanel();
    toast('Cost-per-round badges ' + (on ? 'on' : 'off') + ' for ' + siteName + '.');
  }

  async function setSelectionButton(on) {
    settings.selectionButton = !!on;
    await saveSettings();
    if (!on) hideButton();
    registerMenu();
    if (current) renderPanel();
    toast('"Specs" button on selection ' + (on ? 'on' : 'off') + '.');
  }

  async function setCaliberLinks(on) {
    settings.caliberLinks = !!on;
    await saveSettings();
    registerMenu();
    if (current) renderPanel();
    toast('Caliber links ' + (on ? 'on' : 'off') + '.');
  }

  // ---------------------------------------------------------------------------------------------------------------
  // 9. Start
  // ---------------------------------------------------------------------------------------------------------------

  async function init() {
    await loadSettings();
    registerMenu();
    document.addEventListener('mouseup', onPointerUp, true);
    document.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection ? window.getSelection() : null;
      if (ui && ui.button && (!sel || sel.isCollapsed)) hideButton();
    });
    window.addEventListener('scroll', hideButton, { passive: true });
    if (badgesWanted()) startBadges();
  }

  const ready = init().catch(() => {
    // never break the page
  });

  if (TEST_HOOK) {
    TEST_HOOK({
      lib, ready, settings, ADAPTERS, adapter, siteKey,
      norm, findMoney, priceFromText, cleanTitle, parseSmart, ammoInfo, analyze, plausible, formatCpr, money,
      priceCandidates, choosePrice, titleCandidates, findTile, scanListing, scanProduct, readLdProduct, runScan,
      startBadges, stopBadges, readSelection, checkSelection, cmdParse, openPanel, closePanel,
      setBadges, setSelectionButton, setCaliberLinks, getUi: () => ui,
    });
  }
})();
