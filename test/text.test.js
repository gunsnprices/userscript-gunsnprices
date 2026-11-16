// The text rules: prices in selected text, title clean-up, which titles count as a box of ammo.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers.js";

let api;
before(async () => {
  ({ api } = await load("<!doctype html><title>t</title><p>x</p>", "https://example.org/"));
});

test("prices in selected text", () => {
  assert.equal(api.priceFromText("Federal 9mm 115gr FMJ 50rd Box $17.99"), 17.99);
  assert.equal(api.priceFromText("Sale $15.99 Was $19.99"), 15.99);
  assert.equal(api.priceFromText("$19.99 $15.99"), 15.99); // the sale price is the lower one
  assert.equal(api.priceFromText("Now $12.97 Reg. $13.99 Save $1.02"), 12.97);
  assert.equal(api.priceFromText("$1,299.99"), 1299.99);
  assert.equal(api.priceFromText("$18"), 18);
  assert.equal(api.priceFromText("$16.99 ($0.34/rd)"), 16.99);
  assert.equal(api.priceFromText("Free shipping on orders over $49"), null);
  assert.equal(api.priceFromText("$5 off"), null);
  assert.equal(api.priceFromText("no price here"), null);
});

test("findMoney marks unit prices, savings and 'from' prices", () => {
  const m = api.findMoney("From $10.99 | $0.55/round | Save $2.00 | $20 off | $9.99");
  assert.deepEqual(JSON.parse(JSON.stringify(m.map((x) => [x.value, x.unit, x.excluded, x.from]))), [
    [10.99, false, false, true],
    [0.55, true, false, false],
    [2, false, true, false],
    [20, false, true, false],
    [9.99, false, false, false],
  ]);
});

test("cleanTitle drops store UI lines, prices and per-round fragments", () => {
  assert.equal(
    api.cleanTitle("Winchester USA 9mm Luger 115gr FMJ\n50 Rounds\n$15.99 ($0.32/rd)\nIn Stock\nAdd to Cart"),
    "Winchester USA 9mm Luger 115gr FMJ 50 Rounds",
  );
  assert.equal(api.cleanTitle("  Glock 19 Gen 5   MOS \n 4.8 out of 5 stars \n Sale: $549.00 "), "Glock 19 Gen 5 MOS");
});

test("ammoInfo accepts boxes of ammo with a round count", () => {
  const cases = [
    ["Winchester Ammo 9mm Luger 115 Grain Full Metal Jacket Handgun Ammunition, 50 Rounds", "9×19mm Parabellum", 50],
    ["9mm American Eagle 115 Grain Centerfire Handgun Cartridges - 50 Rounds", "9×19mm Parabellum", 50],
    ["Remington 38 SPL 125gr JHP UMC 50 Rnd Pk", ".38 S&W Special", 50],
    ["Magtech 9mm Luger 115gr FMJ Ammunition 1000rd Case", "9×19mm Parabellum", 1000],
    ["Federal 12 Gauge 2-3/4\" #8 Shot 25 Shells", "12 Gauge", 25],
    ["Federal Top Gun 12 Ga 2 3/4 1 1/8oz #8 250 Rd Case", "12 Gauge", 250],
    ["Box of 20 Federal Power-Shok 30-06 Springfield 150 gr", ".30-06 Springfield", 20],
  ];
  for (const [title, caliber, rounds] of cases) {
    const info = api.ammoInfo(title);
    assert.ok(info, title);
    assert.equal(info.kind, "ammo", title);
    assert.equal(info.rounds, rounds, title);
    assert.equal(info.caliber && info.caliber.name, caliber, title);
  }
});

test("ammoInfo rejects firearms, accessories, components and titles without a count", () => {
  for (const title of [
    "Glock 19 Gen 5 MOS 9mm 4.02in 15rd Pistol",
    "Ruger 10/22 Carbine .22 LR 18.5 in. Barrel 10 Rounds",
    "Smith & Wesson M&P Shield Plus 9mm 3.1 in. 13 Rounds Pistol",
    "MTM Ammo Can 30 Caliber, Holds 500 Rounds",
    "CCI No. 500 Small Pistol Primers - 1000 Count",
    "Hornady XTP Bullets 9mm .355 115 gr JHP 100/Box",
    "ETS 9mm Magazine 30 Rounds",
    "Federal American Eagle 9mm 115gr FMJ",
    "Stanley 25 ft tape measure",
  ]) {
    assert.equal(api.ammoInfo(title), null, title);
  }
});

test("cost per round formatting and sanity range", () => {
  assert.equal(api.formatCpr(0.3398), "$0.34");
  assert.equal(api.formatCpr(0.0666), "$0.067");
  assert.equal(api.formatCpr(2.25), "$2.25");
  assert.equal(api.money(1199.99), "$1,199.99");
  assert.ok(api.plausible(0.3));
  assert.ok(!api.plausible(0.005));
  assert.ok(!api.plausible(45));
  assert.ok(!api.plausible(null));
});

test("analyze: a selection with a title and prices", () => {
  const a = api.analyze("Federal American Eagle 9mm 115gr FMJ 50rd Box\n$17.99\nWas $19.99");
  assert.equal(a.title, "Federal American Eagle 9mm 115gr FMJ 50rd Box");
  assert.equal(a.price, 17.99);
  assert.equal(a.info.kind, "ammo");
  assert.equal(a.info.rounds, 50);
  assert.equal(api.lib.costPerRound(a.price, a.info.rounds), 0.3598);

  const g = api.analyze("Sig Sauer P365 XL 9mm 3.7\" 12+1 Optic Ready $599.99");
  assert.equal(g.info.kind, "firearm");
  assert.equal(g.info.model.model, "Sig Sauer P365 XL");
  assert.equal(g.info.capacity, 12);
  assert.equal(g.info.barrelLength, 3.7);
});

test("adapters", () => {
  assert.deepEqual([...api.ADAPTERS.map((a) => a.id)], ["tractorsupply", "fleetfarm"]);
  assert.equal(api.adapter, null); // example.org
  assert.equal(api.siteKey, "example.org");
});
