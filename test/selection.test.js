// Selecting a title on any page: the "Specs" button, the panel, the menu commands and the settings.
import { test } from "node:test";
import assert from "node:assert/strict";
import { load, fixture, selectElement, shadow, sleep, badges } from "./helpers.js";

const URL_ARTICLE = "https://blog.example.org/range-day";

async function openFromSelection(page, id) {
  selectElement(page, page.document.getElementById(id));
  await sleep(40);
  const btn = shadow(page).querySelector(".btn");
  assert.ok(btn, "Specs button shown");
  btn.click();
  const panel = shadow(page).querySelector(".panel");
  assert.ok(panel, "panel shown");
  return panel;
}

function rows(panel) {
  const out = {};
  const dts = panel.querySelectorAll("dt");
  dts.forEach((dt) => (out[dt.textContent] = dt.nextElementSibling.textContent));
  return out;
}

test("ammo title selected: caliber, rounds, price found next to it, cost per round", async () => {
  const page = await load(fixture("article.html"), URL_ARTICLE);
  const panel = await openFromSelection(page, "ammo-title");
  const r = rows(panel);
  assert.equal(r.Caliber, "9×19mm Parabellum (handgun)");
  assert.equal(panel.querySelector("select").value, "ammo");
  const [price, rounds] = panel.querySelectorAll(".calc input");
  assert.equal(price.value, "15.99"); // from the same paragraph
  assert.equal(rounds.value, "50");
  assert.equal(panel.querySelector(".cpr").textContent, "$0.32 per round (32.0¢)");
  assert.match(panel.querySelector(".hint").textContent, /Price found next to the selection/);

  price.value = "20";
  price.dispatchEvent(new page.window.Event("input"));
  assert.equal(panel.querySelector(".cpr").textContent, "$0.40 per round (40.0¢)");
  rounds.value = "100";
  rounds.dispatchEvent(new page.window.Event("input"));
  assert.equal(panel.querySelector(".cpr").textContent, "$0.20 per round (20.0¢)");
});

test("selection with its price: the price comes from the selection", async () => {
  const page = await load(fixture("article.html"), URL_ARTICLE);
  const panel = await openFromSelection(page, "deal2");
  const [price, rounds] = panel.querySelectorAll(".calc input");
  assert.equal(price.value, "17.49");
  assert.equal(rounds.value, "50");
  assert.equal(panel.querySelector(".cpr").textContent, "$0.35 per round (35.0¢)");
  assert.equal(panel.querySelector(".hint").textContent, "");
});

test("firearm title selected: model, capacity, barrel length", async () => {
  const page = await load(fixture("article.html"), URL_ARTICLE);
  const panel = await openFromSelection(page, "gun-title");
  const r = rows(panel);
  assert.equal(r.Brand, "Glock");
  assert.equal(r.Model, "Glock 19 Gen 5 MOS");
  assert.equal(r.Family, "Glock 19");
  assert.equal(r.Generation, "5");
  assert.equal(r.Capacity, "15 rounds");
  assert.equal(r.Barrel, "4.02 in");
  assert.equal(panel.querySelector(".calc"), null);

  // switching the type re-parses the title
  const select = panel.querySelector("select");
  select.value = "ammo";
  select.dispatchEvent(new page.window.Event("change"));
  assert.equal(shadow(page).querySelector(".panel select").value, "ammo");
});

test("no button for text that is not a gun or ammo title; Escape closes", async () => {
  const page = await load(fixture("article.html"), URL_ARTICLE);
  selectElement(page, page.document.getElementById("plain"));
  await sleep(40);
  assert.equal(shadow(page) && shadow(page).querySelector(".btn"), null);

  await openFromSelection(page, "ammo-title");
  page.document.dispatchEvent(new page.window.KeyboardEvent("keyup", { key: "Escape" }));
  assert.equal(shadow(page).querySelector(".panel"), null);
});

test("caliber links are off by default; the credit link is the only link", async () => {
  const page = await load(fixture("article.html"), URL_ARTICLE);
  let panel = await openFromSelection(page, "ammo-title");
  let links = Array.from(panel.querySelectorAll("a")).map((a) => a.href);
  assert.deepEqual(links, ["https://gunsnprices.com/"]);

  await page.api.setCaliberLinks(true);
  panel = shadow(page).querySelector(".panel");
  links = Array.from(panel.querySelectorAll("a")).map((a) => a.href);
  assert.deepEqual(links, ["https://gunsnprices.com/ammo/handgun-ammo/9-19mm-parabellum", "https://gunsnprices.com/"]);
  assert.equal(page.savedSettings().caliberLinks, true);
});

test("menu: parse the selection, or a pasted title when nothing is selected", async () => {
  const page = await load(fixture("article.html"), URL_ARTICLE, { prompt: "Hornady Critical Defense 380 ACP 90gr FTX 25 Rounds $24.99" });
  const names = page.menu().map((m) => m.name);
  assert.deepEqual(names, [
    "Parse selected title…",
    "Cost-per-round badges on blog.example.org: off",
    "\"Specs\" button on selection: on",
    "Caliber links in the panel: off",
  ]);

  page.window.getSelection().removeAllRanges();
  page.menu()[0].fn();
  let panel = shadow(page).querySelector(".panel");
  assert.equal(rows(panel).Caliber, ".380 ACP (handgun)");
  assert.equal(panel.querySelector(".cpr").textContent, "$1.00 per round (100.0¢)");

  const range = page.document.createRange();
  range.selectNodeContents(page.document.getElementById("gun-title"));
  page.window.getSelection().addRange(range);
  page.menu()[0].fn();
  panel = shadow(page).querySelector(".panel");
  assert.equal(rows(panel).Model, "Glock 19 Gen 5 MOS");

  // copy as JSON
  panel.querySelector(".actions button").click();
  await sleep(10);
  const copied = JSON.parse(page.clipboard[0]);
  assert.equal(copied.model.model, "Glock 19 Gen 5 MOS");
  assert.equal(copied.price, null); // prices next to a selection are looked up for ammo only
});

test("selection button can be turned off and stays off", async () => {
  const page = await load(fixture("article.html"), URL_ARTICLE);
  await page.menu().find((m) => m.name.startsWith("\"Specs\" button")).fn();
  assert.equal(page.savedSettings().selectionButton, false);
  selectElement(page, page.document.getElementById("ammo-title"));
  await sleep(40);
  assert.equal(shadow(page).querySelector(".btn"), null);

  const again = await load(fixture("article.html"), URL_ARTICLE, { settings: page.savedSettings() });
  selectElement(again, again.document.getElementById("ammo-title"));
  await sleep(40);
  assert.equal(shadow(again), null);
});

test("without menu support the panel still works and keeps the selection button on", async () => {
  const page = await load(fixture("article.html"), URL_ARTICLE, { noMenu: true });
  const panel = await openFromSelection(page, "ammo-title");
  const boxes = panel.querySelectorAll("details input[type=checkbox]");
  assert.equal(boxes.length, 3);
  assert.equal(boxes[1].disabled, true);
  // turning badges on from the panel works on any site
  boxes[0].checked = true;
  boxes[0].dispatchEvent(new page.window.Event("change"));
  await sleep(10);
  assert.equal(page.savedSettings().sites["blog.example.org"], true);
  // the deal box (a product link and its price) gets a badge; the plain paragraph does not
  assert.deepEqual(badges(page.document), ["$0.35/rd"]);
  assert.equal(page.document.querySelector("#deal2 .deal-price").nextElementSibling.textContent, "$0.35/rd");
});
