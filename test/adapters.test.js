// Cost-per-round badges on listing and product pages (hand-written fixtures, one per adapter plus a generic one).
import { test } from "node:test";
import assert from "node:assert/strict";
import { load, fixture, badges, badgeAfter, sleep } from "./helpers.js";

function tileOf(document, titleStart) {
  const a = Array.from(document.querySelectorAll("a, h3, span")).find((e) => e.textContent.trim().startsWith(titleStart));
  assert.ok(a, titleStart);
  return a.closest("li, .product-card, .card");
}

test("Tractor Supply adapter: badges on ammo tiles only", async () => {
  const page = await load(fixture("tractorsupply-listing.html"), "https://www.tractorsupply.com/tsc/catalog/handgun-ammo");
  const d = page.document;
  assert.equal(page.api.adapter.id, "tractorsupply");
  assert.deepEqual(badges(d), ["$0.34/rd", "$0.56/rd", "$0.78/rd", "$0.40/rd", "$0.067/rd"]);

  // split dollars and superscript cents: the badge follows the whole price
  assert.equal(badgeAfter(tileOf(d, "Winchester Ammo 9mm").querySelector(".price")), "$0.34/rd");
  // sale price, not the struck one
  assert.equal(badgeAfter(tileOf(d, "Remington 38 SPL").querySelector(".sale-price")), "$0.56/rd");
  // a firearm, an ammo can, an item without a price and a price range get nothing
  for (const t of ["Ruger 10/22", "MTM Ammo Can", "Federal Punch", "Federal Champion"]) {
    assert.equal(tileOf(d, t).querySelector("[data-gnp-cpr]"), null, t);
  }
  // navigation and footer links are ignored
  assert.equal(d.querySelector("nav [data-gnp-cpr], footer [data-gnp-cpr]"), null);
  const b = d.querySelector("[data-gnp-cpr]");
  assert.match(b.title, /^\$16\.99 ÷ 50 rounds = \$0\.34 per round/);
  assert.equal(page.errors.length, 0);
});

test("Fleet Farm adapter: whole-card links, clearance prices, existing per-round prices", async () => {
  const page = await load(fixture("fleetfarm-listing.html"), "https://www.fleetfarm.com/category/hunting/ammunition/handgun-ammunition");
  const d = page.document;
  assert.equal(page.api.adapter.id, "fleetfarm");
  assert.deepEqual(badges(d), ["$0.26/rd", "$0.32/rd", "$0.24/rd"]);
  assert.equal(badgeAfter(tileOf(d, "9mm American Eagle 115").querySelector(".price--clearance")), "$0.26/rd");
  assert.equal(badgeAfter(tileOf(d, "9mm Blazer Aluminum").querySelector(".price")), "$0.24/rd");
  // already shows "$0.32/round"; "From $10.99"; a pistol; primers
  for (const t of ["9mm NATO 124", "5.56 x 45mm", "Smith & Wesson", "CCI No. 500"]) {
    assert.equal(tileOf(d, t).querySelector("[data-gnp-cpr]"), null, t);
  }
});

test("Fleet Farm product page: badge after the main price, updated when the price changes", async () => {
  const url = "https://www.fleetfarm.com/detail/federal-9mm-american-eagle-124-grain-full-metal-jacket-centerfire-handgun-cartridges-50-rounds/0000101550613";
  const page = await load(fixture("fleetfarm-product.html"), url);
  const d = page.document;
  const main = d.querySelector(".pdp__price");
  assert.equal(badgeAfter(main), "$0.32/rd");
  // related products get their own badges, the main price gets exactly one
  assert.deepEqual(badges(d), ["$0.32/rd", "$0.43/rd", "$0.44/rd"]);

  d.getElementById("main-price").textContent = "$14.99"; // another pack or a sale applied by the page
  await sleep(1700);
  assert.equal(badgeAfter(main), "$0.30/rd");
  assert.equal(d.querySelectorAll(".pdp [data-gnp-cpr]").length, 1);
});

test("product pages: several pack sizes get no badge; a logo <h1> falls back to the JSON-LD name", async () => {
  const on = { settings: { sites: { "shop.example.com": true } } };
  const ld = (offers) =>
    `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Product", name: "PMC Bronze 9mm 115gr FMJ 50 Rounds", offers })}</script>`;
  const offer = (price) => ({ "@type": "Offer", price, priceCurrency: "USD" });

  const multi = `<!doctype html><title>p</title>${ld([offer("15.99"), offer("289.99")])}
    <h1>PMC Bronze 9mm 115gr FMJ 50 Rounds</h1><div class="price">$15.99</div>`;
  const p1 = await load(multi, "https://shop.example.com/p/pmc", on);
  assert.deepEqual(badges(p1.document), []);

  const logo = `<!doctype html><title>p</title>${ld(offer("15.99"))}<header><h1>Example Outdoor</h1></header>
    <main><h2 class="pdp-name">PMC Bronze 9mm 115gr FMJ 50 Rounds</h2><div class="buy"><span class="price">$15.99</span></div></main>`;
  const p2 = await load(logo, "https://shop.example.com/p/pmc", on);
  assert.deepEqual(badges(p2.document), ["$0.32/rd"]);
  assert.equal(badgeAfter(p2.document.querySelector(".buy")), "$0.32/rd"); // after the outermost element that is only the price
});

test("generic rules on a site the user turned on", async () => {
  const page = await load(fixture("generic-listing.html"), "https://shop.example.com/ammo.html", {
    settings: { sites: { "shop.example.com": true } },
  });
  const d = page.document;
  assert.deepEqual(badges(d), ["$0.32/rd", "$0.55/rd", "$1.00/rd", "$1.20/rd"]);
  // Magento-style special/old price box: after the special price
  assert.equal(badgeAfter(d.querySelector(".special-price")), "$0.32/rd");
  // Shopify-style sale: after the sale price, not the struck regular price
  assert.equal(badgeAfter(d.querySelector(".price-item--sale")), "$0.55/rd");
  // already per round / price range / implausible price ($5 for 1000 rounds)
  for (const t of ["Federal American Eagle", "Winchester USA 45", "Federal 9mm Ammo Sample"]) {
    assert.equal(tileOf(d, t).querySelector("[data-gnp-cpr]"), null, t);
  }
});

test("other sites: no badges until turned on; turning off removes them", async () => {
  const page = await load(fixture("generic-listing.html"), "https://shop.example.com/ammo.html");
  const d = page.document;
  assert.deepEqual(badges(d), []);
  const item = page.menu().find((m) => m.name.startsWith("Cost-per-round badges on shop.example.com"));
  assert.equal(item.name, "Cost-per-round badges on shop.example.com: off");
  await item.fn();
  assert.equal(badges(d).length, 4);
  assert.deepEqual(page.savedSettings().sites, { "shop.example.com": true });
  assert.ok(page.menu().some((m) => m.name === "Cost-per-round badges on shop.example.com: on"));
  await page.api.setBadges(false);
  assert.deepEqual(badges(d), []);
});

test("an adapter can be turned off", async () => {
  const page = await load(fixture("tractorsupply-listing.html"), "https://www.tractorsupply.com/tsc/catalog/handgun-ammo", {
    settings: { sites: { tractorsupply: false } },
  });
  assert.deepEqual(badges(page.document), []);
});

test("tiles added later (infinite scroll) get badges", async () => {
  const page = await load(fixture("tractorsupply-listing.html"), "https://www.tractorsupply.com/tsc/catalog/handgun-ammo");
  const d = page.document;
  const li = d.createElement("li");
  li.className = "product-tile";
  li.innerHTML = '<a class="product-title" href="/tsc/product/hsm-cowboy-action-357">HSM Cowboy Action 357 Magnum 158 Grain Semi Wadcutter Handgun Ammunition, 50 Rounds</a><div class="price"><span>$45.99</span></div>';
  d.querySelector(".product-grid").appendChild(li);
  await sleep(1700);
  assert.equal(li.querySelector("[data-gnp-cpr]").textContent, "$0.92/rd");
  assert.equal(badges(d).length, 6);
});

test("fails silently: unknown layouts, bot checks, no library", async () => {
  // prices and titles that do not form tiles
  const odd = `<!doctype html><title>Odd</title><table><tr><td>Federal 9mm 115gr FMJ 50 Rounds</td></tr>
    <tr><td>$15.99</td><td>$16.99</td><td>$17.99</td></tr></table><div><span>$</span></div>`;
  const p1 = await load(odd, "https://www.tractorsupply.com/odd");
  assert.equal(p1.errors.length, 0);
  assert.deepEqual(badges(p1.document), []);

  const bot = fixture("tractorsupply-listing.html").replace(/<title>[^<]*<\/title>/, "<title>Just a moment...</title>");
  const p2 = await load(bot, "https://www.tractorsupply.com/tsc/catalog/handgun-ammo");
  assert.deepEqual(badges(p2.document), []);

  const p3 = await load(fixture("tractorsupply-listing.html"), "https://www.tractorsupply.com/tsc/catalog/handgun-ammo", { noLibrary: true });
  assert.equal(p3.api, null);
  assert.deepEqual(badges(p3.document), []);
  assert.equal(p3.errors.length, 0);
});
