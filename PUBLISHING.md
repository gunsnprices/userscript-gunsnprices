# Publishing on Greasy Fork

Status: **not posted yet.** Everything below is ready for the owner of the GunsNPrices account to post.

## Greasy Fork rules and how this script meets them

Checked on 2026-11-16 against [code rules](https://greasyfork.org/en/help/code-rules),
[external scripts](https://greasyfork.org/en/help/external-scripts), [recognized CDNs](https://greasyfork.org/en/help/cdns),
[meta keys](https://greasyfork.org/en/help/meta-keys), [antifeatures](https://greasyfork.org/en/help/antifeatures) and
[allowed markup](https://greasyfork.org/en/help/allowed-markup).

| Rule | This script |
|---|---|
| The description must say what the script does, and the script must not do more | `@description` and the additional info below describe both features and every setting |
| Code must not be obfuscated or minified | Plain JavaScript, ASCII only, no line over 240 characters; checked by `test/metadata.test.js` |
| Libraries should be loaded with `@require`; inlined libraries must name their source | The parser is loaded with `@require`; the header comment names the package, version and repository |
| External code only from recognized CDNs | jsDelivr, GitHub path |
| jsDelivr `/gh/` URLs only with a full 40-character commit hash (a tag is not enough); `/npm/` URLs only with a numeric version | `@require https://cdn.jsdelivr.net/gh/gunsnprices/bubble-gunsnprices@ff88e1eced061c6513d4f0c0e1de27ff5111b644/dist/gunsnprices.min.js` (commit of tag `1.0.0`). The npm package is ES modules only, so it has no file that `@require` could load |
| Code loaded from CDNs may be minified, but not obfuscated | The `@require`'d file is an esbuild minified bundle of the open source `gunsnprices` package, not obfuscated |
| SRI hashes in the Tampermonkey format are allowed; Greasy Fork warns when a hash does not match | `#sha384-fV9e/lO5wkcSkCLr7/lUezpql1fiQDoEOzAvaUlKARmKsSDXWeuHcpunZuy4xxGm`; CI (`npm run check-require`) downloads the file and compares |
| Scripts that mainly load their code from elsewhere are not allowed | All of the script's own logic (panel, selection, badge rules, settings) is in the posted file; only the parser library is external |
| Maximum 2 MB | About 55 KB |
| Features that benefit the author (ads, tracking, referral links, miners) need `@antifeature` | None. No ads, analytics or referral/affiliate links. Caliber links are off by default, sit in the script's own panel and carry no tracking parameters. The panel's credit link to gunsnprices.com is required by the data license; promoting the author's homepage and repository needs no antifeature |
| `@match` / `@include` only for sites the script works on | `*://*/*`, because the selection tool works on any page. Badges run only on tractorsupply.com, fleetfarm.com and sites the user turns on |
| No advertising in the listing, no unrelated keywords, correct language | Listing texts below: English, factual, no other sites named except the two stores the badges are on for |
| Required keys `@name`, `@namespace`, `@version`, `@description`, at least one `@match`/`@include` | All present, plus `@license MIT`, `@homepageURL`, `@supportURL` (shown on the feedback page), `@icon` (inline SVG) |
| `@updateURL`, `@downloadURL`, `@installURL` are stripped by Greasy Fork | Not used |
| No update checks more than once a day, no injecting other Greasy Fork scripts | The script never checks for updates or loads scripts |
| Additional info: Markdown or HTML; links `http`, `https`, `mailto`; images `https` only | The text below uses Markdown with https links only |

## Listing texts

**Name** (from `@name`):

```text
Ammo Cost per Round & Gun Specs (GunsNPrices)
```

**Description** (from `@description`):

```text
Select a gun or ammo product title on any page to see caliber, model, magazine capacity, barrel length, rounds per box and cost per round. Optional cost-per-round badges on store pages. Works offline.
```

**Additional info** (markup: Markdown, language: English):

```markdown
Reads gun and ammo product titles in your browser and shows what is in them: caliber, brand and model, magazine capacity, barrel length, rounds per box and cost per round. The script makes no network requests.

### On any page

Select a product title, with or without its price, and click the small **Specs** button next to the selection, or use **Parse selected title…** in your userscript manager's menu. A panel shows:

- for ammunition: caliber, rounds per box, price and **cost per round** (the price and the round count can be edited);
- for firearms: brand, model, model family, generation, configuration, features, caliber, magazine capacity and barrel length.

If the selection has no price, the script uses a price shown next to the selected title and says so. Struck-through and "was" prices and savings amounts are ignored. **Copy as JSON** copies the result.

### On store pages

A small `$0.34/rd` badge next to ammo prices on listing and product pages. It is on by default on tractorsupply.com and fleetfarm.com; turn it on for any other site with **Cost-per-round badges on this site** in the menu. An item is skipped when its title has no round count, when the page already shows a per-round price, or when the price is a range or unclear.

### Settings

In the menu and in the panel: badges per site, the **Specs** button, and caliber links (off by default; when on, caliber names in the panel link to the GunsNPrices price comparison page for that caliber).

### Privacy

- No network requests, analytics, ads or affiliate links. The script adds no links to store pages.
- The parser library is downloaded by your userscript manager from jsDelivr, pinned to a commit and checked with a SHA-384 hash.

### Source and license

- Source code, tests and issues: https://github.com/gunsnprices/userscript-gunsnprices
- Parser: the [gunsnprices](https://github.com/gunsnprices/gunsnprices-js) library (MIT); its model and caliber data are CC BY 4.0, © [GunsNPrices](https://gunsnprices.com).
- Other developer tools: https://gunsnprices.com/developers
```

## Posting (owner)

1. Sign in at <https://greasyfork.org/en/users/sign_in>. GitHub sign-in with the `gunsnprices-admin` account keeps
   the script tied to the GitHub organization; Google, GitLab or e-mail also work.
2. Post the script in one of two ways:
   - **Sync from GitHub (recommended).** Open the import page (<https://greasyfork.org/en/import>, also linked from
     your profile; it asks you to sign in first) and give the raw URL
     `https://raw.githubusercontent.com/gunsnprices/userscript-gunsnprices/main/gunsnprices.user.js`.
     Greasy Fork imports the code and remembers the URL as the script's sync source.
   - **Post a script.** Paste the contents of `gunsnprices.user.js` into the code box. Later versions are then pasted
     by hand.
3. On the script's admin page, fill in **Additional info** with the Markdown above (markup type Markdown, language
   English). Name and description come from `@name` and `@description`.
4. Check the preview: no warning about the `@require` URL or its integrity hash, the `@match` line shown as
   "all sites", license MIT.
5. Set up the webhook, so that every push updates the script:
   - On Greasy Fork, open your profile and the **webhook** setup page
     (<https://greasyfork.org/en/users/webhook-info>, visible after signing in). It shows the payload URL and a
     secret for your account.
   - On GitHub: repository **Settings > Webhooks > Add webhook**. Payload URL and secret from Greasy Fork, content
     type `application/json`, event **Just the push event**. Do not put the secret in this repository.
   - On the script's admin page, set the sync type to **webhook**.
   - Greasy Fork updates the script when a push *modifies* `gunsnprices.user.js`. GitHub's webhook page lists each
     delivery and Greasy Fork's reply, which helps when an update does not arrive.
6. After the listing is public: add the Greasy Fork link to the **Install** section of `README.md`, and add the
   userscript to <https://gunsnprices.com/developers>.

## Releasing a new version

1. Change the code, add tests, update `CHANGELOG.md`.
2. Raise `@version` in `gunsnprices.user.js` and `version` in `package.json` (Greasy Fork warns when the version does
   not go up after a code change; the tests check that the two match the changelog).
3. `npm test`, `npm run lint`, `npm run check-require`.
4. Commit, tag and push:

   ```bash
   git tag v1.0.1
   git push origin main v1.0.1
   ```

   With the webhook in place Greasy Fork picks up the new version from the push.

### Updating the parser

The parser build comes from `gunsnprices/bubble-gunsnprices` (`dist/gunsnprices.min.js`, hash in `dist/SRI.txt`).
For a new parser version: take the commit hash of the new build there, put it and the new `sha384-` hash in the
`@require` line, set the `gunsnprices` devDependency to the same version, and run `npm run check-require`; it fails if
the hash, the version or the badges on the test page do not match.
