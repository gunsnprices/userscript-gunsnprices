# Ammo Cost per Round & Gun Specs (userscript)

[![CI](https://github.com/gunsnprices/userscript-gunsnprices/actions/workflows/ci.yml/badge.svg)](https://github.com/gunsnprices/userscript-gunsnprices/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

A userscript that reads gun and ammo product titles in your browser and shows what is in them: caliber, brand and
model, magazine capacity, barrel length, rounds per box and cost per round. It works offline: the script makes no
network requests.

- **On any page:** select a product title, with or without its price, and click the small **Specs** button that
  appears next to the selection (or use the **Parse selected title…** menu command). A panel shows the specs; for
  ammo it also shows the cost per round, and you can change the price or the round count.
- **On store pages:** a small `$0.34/rd` badge next to ammo prices on listing and product pages. It is on by default
  on [Tractor Supply](https://www.tractorsupply.com) and [Fleet Farm](https://www.fleetfarm.com), and you can turn it
  on for any other site from the menu.

The parsing is done by [`gunsnprices`](https://github.com/gunsnprices/gunsnprices-js), the open source title parser
behind the price comparison site [GunsNPrices](https://gunsnprices.com). More tools built on it:
[gunsnprices.com/developers](https://gunsnprices.com/developers).

## Install

1. Install a userscript manager such as [Tampermonkey](https://www.tampermonkey.net/) or
   [Violentmonkey](https://violentmonkey.github.io/).
2. Open [`gunsnprices.user.js`](https://github.com/gunsnprices/userscript-gunsnprices/raw/main/gunsnprices.user.js);
   the manager offers to install it.

The script is also being prepared for [Greasy Fork](https://greasyfork.org); the link will be added here once it is
listed.

## Using it

### Selected text

Select a title such as

```text
Winchester USA 9mm Luger 115gr FMJ 50 Rounds  $15.99
```

and click **Specs**. The panel shows:

```text
Type        Ammunition
Caliber     9×19mm Parabellum (handgun)
Price $     15.99      Rounds  50
            $0.32 per round (32.0¢)
```

For a firearm title (`Glock 19 Gen 5 MOS 9mm 4.02in 15rd Pistol`) it shows the brand, model, model family,
generation, configuration, features, caliber, magazine capacity and barrel length.

- The price is taken from the selection. If the selection has no price, the script looks for one next to the
  selected title on the page and says so; check that it belongs to the same item.
- Old prices (struck through, "Was", "Reg."), savings ("Save $2.00") and amounts such as "orders over $49" are
  ignored. When a selection has several prices, the lowest one is used.
- The **Type** list switches between ammunition and firearm when the guess is wrong.
- **Copy as JSON** copies the parsed result.
- The button only appears for text that contains a caliber, a known model or a round count. Press `Esc` to close
  the panel.

### Cost-per-round badges

On sites where the badges are on, the script looks for product tiles that hold an ammo title with a round count
("50 Rounds", "20rds", "Box of 25", "1000rd Case") and one clear price, and adds the cost per round after the price.
On product pages it uses the page title and the main price. Hovering a badge shows the calculation.

Nothing is added when:

- the title has no round count, or the item is a firearm, magazine, ammo can, primer or other accessory;
- the page already shows a per-round price for the item;
- the tile shows a price range or a "from" price (several pack sizes);
- the price is unclear, or the result is outside 2 cents to $30 per round.

Tiles that appear later (infinite scroll, filters) and price changes on a product page are handled as they appear. The badges are matched to the page by general rules (a title and its price inside the same product tile),
not by store-specific selectors. If a store changes its layout and the rules no longer find tiles, the page is left
as it is.

### Menu commands and settings

The userscript manager's menu has:

| Command | Default |
|---|---|
| Parse selected title… (asks for a title when nothing is selected) | |
| Cost-per-round badges on *this site*: on/off | on for Tractor Supply and Fleet Farm, off elsewhere |
| "Specs" button on selection: on/off | on |
| Caliber links in the panel: on/off | off |

The same settings are in the panel under **Settings**, for managers without menu commands. When caliber links are
on, caliber names in the panel link to the GunsNPrices price comparison page for that caliber. The panel always has
one credit link to gunsnprices.com, as the data license requires. The script adds no links to store pages.

## Privacy

- The script makes no network requests and sends nothing anywhere. It has no analytics, ads or affiliate links.
- The only download is the parser library, which your userscript manager fetches from jsDelivr when it installs or
  updates the script. The `@require` URL is pinned to a commit and checked with a SHA-384 integrity hash.
- Settings (the switches above and the list of sites where badges are on or off) are stored by your userscript
  manager.

## How it works

The userscript loads the browser build of the [`gunsnprices`](https://www.npmjs.com/package/gunsnprices) npm package
0.1.2 from
[`gunsnprices/bubble-gunsnprices`](https://github.com/gunsnprices/bubble-gunsnprices) through
`@require` (`window.GunsNPrices`), and uses its `parseTitle` and `costPerRound` functions. The parser knows 293
calibers and model dictionaries for 50 firearm brands; see its README for what it recognizes and how accurate it is.

The rest is in [`gunsnprices.user.js`](gunsnprices.user.js), in plain readable JavaScript:

- the selection button, the panel (in a shadow DOM, so page styles do not change it) and the menu commands;
- the badge rules: find elements whose text is an ammo title with a round count, walk up to the smallest element that
  also holds a price without containing another product, pick the current price (sale price over struck or "was"
  prices), and skip the tile if it already shows a per-round price or a price range.

## Limitations

- Titles in English from US stores, prices in US dollars.
- Cost per round needs the round count in the title. Stores that put the pack size only in a drop-down get no badge,
  and a product page whose structured data lists several prices (several pack sizes) gets none either.
- The Tractor Supply and Fleet Farm entries were written from the stores' product titles and the general rules;
  the tests use hand-written pages, not copies of the stores' markup.
- Prices with dollars and cents split into separate elements are handled for the common patterns (`$16<sup>99</sup>`,
  separate "cents" elements); unusual price markup is skipped.

## Development

```bash
npm ci
npm test               # node --test with jsdom, on the pages in test/fixtures/
npm run lint           # ESLint
npm run check-require  # downloads the @require'd build, checks its SRI hash and runs one page with it
```

`test/fixtures/` holds a small listing page for each store entry, a product page, a page with mixed store markup and
an ordinary article. They are written by hand for the tests.

Publishing steps and the Greasy Fork listing texts are in [PUBLISHING.md](PUBLISHING.md).

## License

The userscript is under the [MIT License](LICENSE). The parser it loads is MIT; the parser's model and caliber data are
under [CC BY 4.0](LICENSE-DATA), credit **GunsNPrices ([gunsnprices.com](https://gunsnprices.com))**.

Questions and corrections: [open an issue](https://github.com/gunsnprices/userscript-gunsnprices/issues) or write to
app@gunsnprices.com.
