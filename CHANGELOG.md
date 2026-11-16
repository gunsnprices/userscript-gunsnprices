# Changelog

## 1.0.0 - 2026-11-16

First release.

- Select a gun or ammo product title on any page and click **Specs** (or use the **Parse selected title…** menu
  command) to see the caliber, brand and model, magazine capacity, barrel length, rounds per box and cost per round.
  The price comes from the selection or from next to it, and can be edited in the panel.
- Cost-per-round badges next to ammo prices on listing and product pages: on by default on tractorsupply.com and
  fleetfarm.com, and on any other site turned on from the menu. Items without a round count in the title, pages that
  already show a per-round price, price ranges and unclear prices are skipped.
- Settings in the userscript manager's menu and in the panel: badges per site, the selection button, caliber links
  (off by default).
- Parser: gunsnprices 0.1.2, loaded with `@require` from jsDelivr, pinned to a commit and checked with SRI.
  No network requests from the script.
