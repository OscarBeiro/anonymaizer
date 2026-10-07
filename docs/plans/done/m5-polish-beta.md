# Milestone 5 — Polish & public beta

The milestone that turns a working tool into something a stranger can find,
trust and use. Nothing here changes what anonymization *does*; it changes who
can reach it and what they see before they paste anything sensitive.

Three strands, in dependency order: the **app shell** (a real design pass, a
light/dark switch, a menu to hold the settings the wizard has been growing),
the **landing** (public-facing page plus the legal pages European and Spanish
law require of it), and **distribution** (consent-gated analytics and an
automated Cloudflare Pages deploy).

M4b is a prerequisite for `P18` only — the language selector has nothing to
select until `P14`/`P15` land the `t()` layer and the locale files. Everything
else in M5 is independent of M4 and could run first if the beta date pulls in.

---

## Decided in planning (2026-09-21), do not re-litigate

- **"Two modes" is light/dark theme.** Not Simple/Advanced, not
  Placeholders/Realistic (that stays where M4b `P13` put it, an output switch
  on 2.3), not a split of anonymize/restore. A visual theme switch, sitting in
  the same menu as the language selector.
- **The landing is a route inside the same app**, not a separate site or repo.
  `/` is the landing, `/app` is the wizard, one bundle, one deploy, one domain.
  No subdomain. The cost of this choice is that the tool and the analytics now
  share an origin, which is exactly why `P21`'s gating is written as strictly
  as it is.
- **Hard rule 2 is amended, narrowly, and only by `P21`.** Analytics may load
  on the public deployment, in both landing and app, after explicit consent.
  It must be *impossible* for analytics to load in a locally-installed copy —
  the portable build, a `file://` page, localhost, or any self-hosted origin.
  That is a build-time exclusion *and* a runtime guard, not one or the other.
  See `P21` for the exact CLAUDE.md wording.
- **Analytics is Google Analytics 4 + Metricool**, as asked. Both set cookies,
  so both are behind prior opt-in — see the legal note in `P20`.
- **The legal pages are drafts for a lawyer to review, not legal advice.**
  The sessions produce complete, specific, well-structured text with the right
  articles cited and every placeholder the drafter must fill marked
  `{{LIKE_THIS}}` — they do not produce something to publish unreviewed.
- **Deploy is Cloudflare Pages, automated from GitHub Actions**, not the
  Cloudflare Git integration. The repo is `OscarBeiro/anonymaizer`; the build
  already has two outputs and a portable variant, and a workflow keeps that
  logic in the repo where it is reviewable, instead of in a dashboard.

## Two traps to fix in the prompts, not later

1. **`base: './'` and a history router are incompatible.** `vite.config.ts`
   sets `base: './'` for both builds, deliberately, so the portable
   `index.html` resolves its siblings from a `file://` origin. A page served
   at `/app` with relative asset URLs will request `/app/assets/…` and 404.
   The hosted build must switch to `base: '/'` while the portable build keeps
   `'./'` — and the portable build must therefore use a **hash** router or no
   router at all, since `file://` has no server to rewrite paths. `P19` owns
   this; it is the single most likely way to ship a white page.

2. **The service worker will happily serve a stale landing forever.**
   `public/sw.js` predates the landing. A cache-first shell that now covers a
   marketing page and three legal pages means a privacy-policy update is
   invisible to anyone who has visited once. `P19` moves the legal and landing
   routes to network-first (or excludes them from the cache outright) before
   `P20` writes anything into them.

---

### [x] P16 — Design pass: tokens, then the shell

**Done 2026-09-27 (v0.8.0).** Tokens in `src/styles/tokens.css` (imported by
`index.css`, so the portable build inlines it); no literal colours remain in
`App.css`/`index.css`. Off-scale spacings (5/6/10/14px) were snapped to the 4px
scale. The shell is now header (mark, version, tagline, empty `.app-header-slot`
for P18) / sidebar + main / footer (empty `.app-footer-links` for P20). Below
640px the sidebar folds into a horizontal step strip and the sidebar stats are
hidden; the mapping table scrolls horizontally inside its wrapper. The dark
values from the old `index.css` moved into `tokens.css` under
`prefers-color-scheme` only — P17 adds the `data-theme` guards.

The UI is 393 lines of `App.css` plus 109 of `index.css`, grown one component
at a time. This session does not redesign screen by screen; it extracts the
system the screens are already half-using, so `P17`'s theme switch is a
variable swap rather than a rewrite of every rule.

> Add `src/styles/tokens.css`: CSS custom properties on `:root` for colour
> (surface, surface-raised, text, text-muted, border, the `#aa3bff` accent and
> its hover/active/subtle variants, plus semantic success/warning/danger),
> spacing on a 4px scale, radii, two shadow levels, and a type scale. Every
> value currently hardcoded in `App.css`/`index.css` becomes a token
> reference; a literal colour left anywhere outside `tokens.css` is a bug this
> session exists to remove.
> No new dependency, and no CSS framework: hard rule 3 aside, a framework's
> default is a webfont `@import`, which hard rule 2 forbids. Type stays on the
> system font stack already in `index.css`.
> Rework the shell in `App.tsx` (`:225` currently renders the version inline):
> a real header — product mark, version, and a slot the `P18` menu will fill —
> and a footer carrying the links `P20` creates. `StepNav.tsx` gets the token
> treatment in the same pass; it is the most-seen component in the app.
> Check the wizard at 360px wide. The review table in `ReviewStep.tsx` is the
> component that will break, and the landing (`P19`) makes phone traffic real
> in a way it has not been so far.
> No core changes, so no new core tests. Verify `npm run build` and
> `npm run build:portable` both still produce a working page — the portable
> build inlines CSS and is the one that notices a new stylesheet import.

### [x] P17 — Light/dark theme, the "two modes"

**Done 2026-09-27 (v0.9.0).** `tokens.css` carries the dark block twice
(`@media … :root:not([data-theme='light'])` and `:root[data-theme='dark']`),
identical by convention — plain CSS cannot OR a media query with a selector.
`anonymaizer.theme` via `loadTheme`/`saveTheme`/`parseTheme` in `session.ts`;
`src/lib/theme.ts#applyTheme` sets the attribute and `<meta name="theme-color">`
and re-runs on OS changes; the pre-paint inline script in `index.html` mirrors
it. Placeholder `<mark>`s get `--color-mark-text` (accent-active in light,
~6:1; the plain accent was under AA on its tint). The manifest cannot switch
per theme — `theme_color`/`background_color` are static JSON — so it now uses
the light surface; the live `<meta>` overrides it in the browser. A temporary
`ThemeControl` sits in the header slot until P18's menu.
**Note for P22:** the inline script needs a CSP hash (`'sha256-…'`), not
`'unsafe-inline'`.

> Three states, not two: `light`, `dark`, `system`. `system` is the default and
> follows `prefers-color-scheme`; an explicit choice overrides it and persists.
> Implement as `data-theme` on `<html>`, with `tokens.css` redefining its
> colour tokens under `@media (prefers-color-scheme: dark)` guarded by
> `:root:not([data-theme='light'])` and again under `:root[data-theme='dark']`,
> so the system case and the explicit case share one set of values.
> Set the initial attribute in a tiny inline script in `index.html`, before the
> bundle loads, or the page flashes light before React mounts. That script
> reads the same localStorage key the app writes.
> Persist via a fifth key in `src/lib/session.ts` — `anonymaizer.theme`,
> `loadTheme`/`saveTheme` mirroring the existing pairs, tolerating a stored
> value that is not one of the three.
> Update `public/manifest.webmanifest`'s `background_color`/`theme_color` and
> the `<meta name="theme-color">` in `index.html` to switch with the theme.
> Dark mode is where the placeholder highlighting in `renderHighlighted`
> (`MappingPanels.tsx:7`) and the diff/highlight colours get checked for
> contrast — a `<mark>` tuned for a white page is unreadable on a dark one.
> Aim for WCAG AA on body text in both themes.

### [x] P18 — The menu: language, theme, settings

**Done 2026-09-27 (v0.10.0).** `SettingsMenu.tsx` is a right-edge slide-over
`<dialog>` opened with `showModal()` (page inert, Escape closes, backdrop click
closes, focus returned explicitly), from a "⚙ Settings" header button. Sections:
Language (M4b deferred — a disabled English-only selector marks the slot),
Theme (`ThemeControl`, moved out of the header), Detection (`CategoryToggles`,
open by default here, plus `NerToggle`), Dictionary (`RulesEditor`), About
(version, a `legalLinks` slot for P20, "Clear all local data"). The rules
editor leaving the step flow removed the old 2.1 Rules sub-step, so Review is
now 2.1 Placeholders / 2.2 Sanitized text / 2.3 Statistics (`wizard.ts` and its
tests updated). 2.1 keeps a "N categories off · Detection settings and custom
rules" link that opens the menu at Detection. `clearLocalData()` in
`session.ts` removes every `anonymaizer.`-prefixed key, not a fixed list; App
then clears the NER cache and reloads. Test: `session.test.ts` asserts no
prefixed key survives and unrelated keys do.

Settings have been accumulating with nowhere to live — NER opt-in
(`NerToggle.tsx`), the dictionary rules editor (`RulesEditor.tsx`), M4a's
category toggles, and now theme and language. This session gives them one home
and takes them out of the wizard's flow.

**Depends on M4b `P14`/`P15`**: the language selector needs the `t()` layer and
more than one locale to be worth building. If M5 runs before M4b, build the
menu with theme + the existing settings and leave a marked slot for language.

> A header menu button opening a panel (a `<dialog>` or a slide-over — not a
> hover dropdown, it has to work on touch), with sections: **Language**
> (selector over the locales M4b registers, plus "follow browser"), **Theme**
> (the `P17` three-state control), **Detection** (M4a's category toggles and
> the NER opt-in, moved here from the wizard), **Dictionary** (the rules
> editor, moved out of the step flow), and **About** (version, links to the
> `P20` legal pages, a "clear all local data" action that wipes every
> `anonymaizer.*` localStorage key and the NER model cache via
> `deleteModelCache`).
> Moving the category toggles out of `ReviewStep.tsx` contradicts M4a's
> "collapsible panel at the top of 2.2" decision, and that is deliberate now
> that a menu exists — but keep a link from 2.2 into the menu's Detection
> section, or the discoverability M4a was protecting is lost.
> Keyboard and focus behaviour matter here more than anywhere else in the app:
> Escape closes, focus is trapped while open, focus returns to the button.
> Tests: the settings persistence round-trips are already covered per-key; add
> a test that "clear all local data" leaves no `anonymaizer.`-prefixed key
> behind, since that is a promise the privacy policy will make in writing.

### [x] P19 — Landing page and the routing split

**Done 2026-09-27 (v0.11.0).** Hand-rolled router in `src/lib/router.ts`
(`matchRoute` is unit-tested; unknown paths fall back to the landing).
`src/Root.tsx` picks `PortableRoot` (wizard only) or `HostedRoot` on the
`__PORTABLE__` define; the wizard, landing and legal pages are all
`React.lazy`, and the landing/legal lazies are guarded by the constant so the
portable output contains none of it (verified by grep). `base` is `'/'` hosted,
`'./'` portable, commented in `vite.config.ts` — the hosted build must now sit
at a domain root. The landing's paste box / file picker / drop zone hands the
document over in memory (`src/lib/handoff.ts`, never localStorage) and the
wizard opens at Review with it loaded. `sw.js` (cache `v3`): **every**
navigation is network-first with a cache fallback, not only the landing and
legal routes — `/app` is the same `index.html`, and keeping it cache-first is
exactly P21b's stale-release bug; hashed assets stay cache-first. SEO: meta,
canonical (updated per route), OG/Twitter tags, a self-rendered
`public/og-image.png`; `robots.txt`/`sitemap.xml` are generated at build time
from `VITE_SITE_ORIGIN` in `.env` (**`https://anonymaizer.pages.dev` is a
placeholder — set the real domain before launch**). Manifest `start_url` is
now `/app`. **Not done:** `lang` switching with the M4b locale — M4b P14/P15
are deferred, so there is only `en`; wire `document.documentElement.lang` when
the `t()` layer lands.

Reference point is saferlayer — as a reference for *structure and register*,
not something to copy. What a page like that gets right is that the tool is
visible above the fold and the trust claims are specific.

The landing's argument writes itself and is unusually strong: nothing is
uploaded, there is no backend, the tool runs in the tab, and there is a
portable build that runs with no network at all. Say that plainly, and let the
upload/paste control on the page *be* the call to action — it takes the file
and drops the user into `/app` with it already loaded, rather than a button
that merely navigates.

> **Routing.** Hand-rolled over the History API is enough for four routes and
> adds no dependency; reach for `react-router` only if `P20`'s legal pages plus
> anchors make it genuinely awkward. Routes: `/` landing, `/app` wizard,
> `/privacy`, `/cookies`, `/terms`. The wizard is `React.lazy`-loaded, so a
> landing visitor does not download it — the inverse of the code-splitting the
> parsers already get.
> **The `base` trap (above).** Hosted build → `base: '/'`; portable build keeps
> `base: './'` and renders the wizard directly with no router. Guard it on the
> existing `ANONYMAIZER_PORTABLE` env flag in `vite.config.ts` and comment it
> there, next to the existing two-builds note.
> **The service worker (above).** Before the landing exists, fix `public/sw.js`
> so `/`, `/privacy`, `/cookies` and `/terms` are network-first with a cache
> fallback, and the app shell stays cache-first. Bump its cache version.
> **Content.** Hero (what it does, in one sentence, plus the paste/upload
> control), how it works in three steps mirroring the wizard, a "your data
> never leaves this tab" section that is concrete about the two exceptions —
> the opt-in NER model download and, after `P21`, analytics — supported
> formats from M3, the portable/offline build, and a footer with the legal
> links and contact.
> **SEO/meta, without a network call**: `<title>`, description, canonical,
> Open Graph and Twitter tags, `lang` switching with the M4b locale, a
> self-hosted OG image in `public/`, plus `robots.txt` and a static
> `sitemap.xml`. No hosted font, no hosted script — hard rule 2 still holds
> here; `P21` is the only amendment.
> Keep the landing in `src/landing/`, treated like the rest of the React UI.
> `src/core/` is untouched by this entire milestone (hard rule 4).

### [x] P20 — Legal: privacy, cookies, terms

**Done 2026-09-27 (v0.12.0) — drafts, not for publication until reviewed.**
Texts in `src/legal/{privacy,cookies,terms}.tsx`, Spanish and English, one
layout (`src/landing/LegalPage.tsx`: `?lang=` or browser language, sets
`<html lang>`). "Last updated" is `LEGAL_LAST_UPDATED` in `src/legal/meta.ts`,
next to `CONSENT_POLICY_VERSION` for P21. Operator facts come from
`src/site.ts`. The cookie page's "Change cookie settings" button fires
`requestConsentBanner()` (`src/lib/consentBus.ts`) for P21's banner. Links:
landing/legal footer, wizard footer and the menu's About (`SiteLinks`; the
portable build links to the public copies). `meta.test.ts` fails if a
placeholder is used but missing from `LEGAL_PLACEHOLDERS`.

**Placeholders to fill before launch** (values in `src/site.ts`, or in the
legal texts where marked):
`{{LEGAL_NAME}}`, `{{NIF}}`, `{{ADDRESS}}`, `{{CONTACT_EMAIL}}`,
`{{REGISTRY_DATA}}` (Registro Mercantil data, or remove if a natural person),
`{{DPO_CONTACT_OR_NONE}}`, `{{JURISDICTION}}`, `{{GA4_MEASUREMENT_ID}}`,
`{{METRICOOL_COOKIES}}` and `{{METRICOOL_COOKIE_DURATION}}` (**check in a
browser with the Metricool tag loaded — not verified here**),
`{{METRICOOL_RETENTION}}`, `{{CLOUDFLARE_LOG_RETENTION}}`, `{{LICENSE}}` (the
repo has no LICENSE file yet), `{{TRADEMARK_STATUS}}`.
Also confirm: GA4 data retention set to 2 months in the GA4 admin (the policy
says so); the NER download hosts named (Hugging Face, jsDelivr) still match
`src/workers/ner.worker.ts`.

Drafts for review. The pages are real pages in the app (`P19`'s routes), in
Spanish and English, sharing one layout component.

The applicable frame, to be cited explicitly rather than gestured at:
**GDPR** (Regulation (EU) 2016/679) arts. 13–14 for the information duty and
arts. 15–22 for rights; **LOPDGDD** (Ley Orgánica 3/2018); **LSSI-CE** (Ley
34/2002) art. 10 for the provider-identification duty and art. 22.2 for the
cookie consent rule — art. 22.2 is the one that forces opt-in *before* loading
GA4 or Metricool, and it is national law, not GDPR; and the **AEPD**'s cookie
guidance for what a compliant banner may and may not do.

The unusual and genuinely favourable fact to state clearly: the anonymization
itself processes no personal data on anyone's server, because there is no
server. The document never leaves the browser. What the policy actually has to
cover is the analytics on the site — and, separately, a note that the *user*
may themselves be a controller for the documents they process, which is their
responsibility, not the tool's.

> **Privacy policy**: identity and contact of the controller
> (`{{LEGAL_NAME}}`, `{{NIF}}`, `{{ADDRESS}}`, `{{CONTACT_EMAIL}}`, and DPO if
> one is appointed), what is and is not processed — with the no-backend fact
> stated first and precisely — purposes and legal bases (consent for
> analytics, art. 6(1)(a); legitimate interest where it genuinely applies and
> nowhere else), recipients (Google, Metricool, Cloudflare as hosting
> provider), **international transfers**: GA4 sends data to the US, so name the
> EU-US Data Privacy Framework and Google's SCCs, retention periods, the
> art. 15–22 rights and how to exercise them, and the right to complain to the
> AEPD with its address. Also: localStorage use (session, rules, settings,
> theme) — not personal data leaving the device, but disclose it — and the
> opt-in NER model download, which does hit a third-party host and therefore
> discloses an IP address.
> **Cookie policy**: a table — name, provider, purpose, type, duration — for
> every GA4 and Metricool cookie and for any consent cookie the banner sets,
> plus how to withdraw consent (a link that reopens the banner, which `P21`
> must provide) and browser-level instructions.
> **Terms of use**: `{{LEGAL_NAME}}` identification per LSSI-CE art. 10,
> acceptable use, a warranty disclaimer stated honestly — automated detection
> is best-effort and precision-first per spec §4a, it will miss things, and the
> user must review output before sharing it; this is the clause that matters
> most for a tool people will trust with confidential documents — limitation of
> liability, IP and licence, applicable law and jurisdiction
> (`{{JURISDICTION}}`).
> Mark every fact the drafter must supply as `{{PLACEHOLDER}}` and list them at
> the top of the session's output so none ships unfilled. End each page with a
> "last updated" date driven by a constant, not hand-typed.
> Add the footer links in `P16`'s shell and the "About" links in `P18`'s menu.

### [x] P21 — Consent banner and analytics, public deployment only

**Done 2026-09-27 (v0.13.0).** CLAUDE.md hard rule 2 amended with the wording
below. Gates: `__ANALYTICS_ENABLED__` (vite define; true only for
`ANONYMAIZER_ANALYTICS=1` and never portable) and
`isPublicDeploymentAt()` — https + hostname of `VITE_SITE_ORIGIN` exactly —
both in `src/lib/analytics.ts`, predicate unit-tested against file://,
localhost, http, a LAN IP, a lookalike, a subdomain/preview and a self-hosted
host. All host-contacting code is in `src/lib/analyticsLoader.ts`, imported
only behind the define: verified a plain `npm run build` and the portable build
contain no `googletagmanager`/`metricool.com`, and a flagged build does. IDs
come from `VITE_GA4_ID` / `VITE_METRICOOL_HASH` at build time (the loader skips
a service whose ID is unset). Consent: `src/lib/consent.ts`
(`anonymaizer.consent` in localStorage with timestamp and
`CONSENT_POLICY_VERSION`; tested) and `src/landing/ConsentBanner.tsx` —
Reject/Accept share one style, "Choose" shows an unticked Analytics box, no
close button; the cookie page reopens it; reject-after-accept deletes `_ga*`
cookies and reloads. GA4 via Consent Mode v2 (all denied, then
`analytics_storage` granted), no Google signals/ad personalisation, page_view
sent manually with the route path only. Verified end to end in Chromium
against a flagged build served as `https://anonymaizer.test`: no external
request before a choice or after Reject; both hosts after Accept.
**For P22:** CSP must allow `www.googletagmanager.com` (script),
`*.google-analytics.com` / `*.analytics.google.com` (connect, img),
`tracker.metricool.com` (script, connect, img) — **check Metricool's actual
beacon hosts in a browser**, they were not observable here.

This is the session that amends hard rule 2, and it should read as narrowly as
the amendment is.

> **First, amend CLAUDE.md**, in the same commit, so no later session has to
> guess. Replace hard rule 2 with: *"No network calls at runtime from the
> anonymization tool itself. The two exceptions are the opt-in M2 NER model
> download (cached locally) and, on the public hosted deployment only,
> consent-gated analytics. Any locally-installed copy — the portable build, a
> `file://` page, localhost, or any self-hosted origin — makes no network call
> of any kind, ever."*
> **Two independent gates, both required.** Build-time: a
> `__ANALYTICS_ENABLED__` define in `vite.config.ts`, false whenever
> `ANONYMAIZER_PORTABLE === '1'` and false unless the deploy workflow sets it,
> so `npm run build:portable` and a local `npm run build` contain no analytics
> code at all (verify by grepping the output for `gtag` and `metricool` —
> make that a step in `P22`'s workflow). Runtime: refuse to load unless
> `location.protocol === 'https:'` and the hostname is the production domain
> exactly. Put both behind one `src/lib/analytics.ts#isPublicDeployment()` and
> unit-test the predicate against `file://`, `localhost`, a LAN IP, a
> lookalike hostname and the real one.
> **Consent first, always.** Nothing loads before an explicit accept — no
> pre-loaded tag, no "continue implies consent", no pre-ticked box, and Reject
> as prominent as Accept (AEPD guidance; art. 22.2 LSSI-CE). Granular at least
> to "analytics" as a category. Store the decision with its timestamp and
> policy version in localStorage, not a cookie, and re-ask when the policy
> version changes. Withdrawal reopens the banner from the cookie-policy link
> and, on reject-after-accept, deletes the `_ga*` cookies it can reach.
> **GA4** via Consent Mode v2, defaulting every signal to `denied` and updating
> on accept; anonymised IP; no user-id, no cross-site advertising signals.
> **Metricool** loaded only on the same accept.
> **Never on the wizard's content.** Whatever is instrumented, it is page views
> and coarse interactions — never the pasted text, never a file name, never a
> detected entity, never a count of them. Write that as a comment in
> `analytics.ts` and as a line in the privacy policy, because it is the promise
> the whole product rests on.
> A strict CSP in `P22`'s `_headers` is what makes this enforceable rather than
> merely intended; the two sessions have to agree on the allowed hosts.

### [x] P21b — Service worker must not pin users to an old build

**Done 2026-09-27 (v0.14.0).** Navigations network-first since P19. `CACHE_NAME`
is stamped at build time by the `swVersion` plugin in `vite.config.ts`
(`anonymaizer-<version>-<hash of emitted file names>`); `activate` drops older
caches. No `skipWaiting()` on install: `src/lib/swUpdate.ts` detects a waiting
worker (also re-checked when the tab becomes visible) and `UpdatePrompt.tsx`
shows "New version available — Reload", which posts `SKIP_WAITING` and reloads
on `controllerchange`. Registration skipped in the portable build.
**Found and fixed on the way:** P19's lazy wizard broke offline `/app` for an
installed PWA that had never opened the wizard online. The same plugin now
injects a precache list (entry + App/Landing/LegalPage chunks, their static
imports and CSS; parsers and NER stay fetch-on-use).
Tested in Chromium (persistent profile, static server, symlink swapped between
two builds): v*N* loads and is controlled → swap to v*N+1*, reload once → the
prompt shows → Reload → new version, only the new cache remains → offline
reload and offline `/app` both load. Note: because navigations are
network-first, the reload before the prompt already shows the new page; the
prompt then only activates the new worker (and its cache).

Found 2026-09-26 (v0.4.5). `public/sw.js` is cache-first for every same-origin
GET, and nothing ever invalidates it: `CACHE_NAME` is a hand-set constant
(`anonymaizer-v2`), and `/` and `/index.html` are served from the cache. After a
deploy, a returning user keeps the old `index.html`, which points to the old
hashed `/assets/*` chunks. They run the previous release until the constant is
bumped by hand, and the new release never reaches them. The same mechanism froze
source modules in dev, where the NER word-boundary fix never reached the browser.
v0.4.5 fixed that half by registering the worker in production only
(`src/main.tsx`).

> Fix before `P22` makes deploys routine:
> - Serve the navigation request (`/`, `/index.html`) network-first, falling
>   back to the cache offline. Keep hashed `/assets/*` cache-first; they are
>   immutable by name.
> - Derive `CACHE_NAME` from the build (inject `__APP_VERSION__` or a build
>   hash into `sw.js` at build time) so that `activate` drops the previous
>   release's cache.
> - When a new worker is waiting, show a small "New version available —
>   reload" prompt instead of taking over silently mid-session. A reload loses
>   no work, since the session lives in localStorage.
> - Still no network beyond same-origin (hard rules 2–3). The portable build is
>   unaffected.
>
> Test: build v*N*, load it, build v*N+1*, reload once. You should get the
> prompt, and after accepting it the new badge shows. Offline, the last cached
> release still loads.

### [x] P22 — Automated Cloudflare Pages deploy

**Done 2026-09-27 (v0.15.0) — written and checked locally; never run on
GitHub.** `.github/workflows/deploy.yml`: lint, test, build; push to `main`
is the only build with `ANONYMAIZER_ANALYTICS=1` (IDs from repo *variables*
`VITE_GA4_ID`/`VITE_METRICOOL_HASH`); PRs build without it, are checked with
`scripts/check-no-analytics.sh` (POSIX find/grep; fails on a grep error rather
than passing), and get a preview deploy + PR comment unless from a fork (no
secrets). The portable build is checked on every run; on a `v*` tag it is
attached to the release as `anonymaizer-portable-<tag>.html`. One-time manual
steps (Pages project via Direct Upload, token scope, secrets, custom domain and
DNS, `VITE_SITE_ORIGIN`) are in the workflow's header comment.
`public/_redirects` holds the SPA fallback; no `_routes.json` (that file is for
Pages Functions, which this project has none of). `_headers` is **generated**
by the `headersFile` plugin in `vite.config.ts`: the CSP carries the sha256 of
index.html's inline theme script (no `'unsafe-inline'` for scripts), allows
the NER hosts (`huggingface.co`, `*.huggingface.co`, `*.hf.co`,
`cdn.jsdelivr.net`, plus `'wasm-unsafe-eval'`), and the P21 analytics hosts
only in a flagged build; plus Referrer-Policy, nosniff, X-Frame-Options,
Permissions-Policy, HSTS, immutable `/assets/*`, and `no-cache` for
`index.html`, every route path, `sw.js` and the manifest. Verified in Chromium
with the generated CSP applied: pre-paint theme script, paste handoff, PDF
import (pdf.js worker), settings, legal page — no violations.
**Still to verify on the real deployment:** the NER model download under the
CSP (the model hosts redirect; `*.hf.co` should cover the current CDN), and
the Metricool beacon hosts once the tag runs. **Known limit:** the released
portable "single file" still needs its sibling `ner.worker-*.js` for the
opt-in NER (the P7d caveat); everything else works from the one file.

> A GitHub Actions workflow (`.github/workflows/deploy.yml`) on push to `main`:
> `npm ci`, `npm run lint`, `npm test`, `npm run build`, then publish `dist/`
> with `cloudflare/wrangler-action` and `pages deploy`, using
> `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets. Set
> `__ANALYTICS_ENABLED__` here and nowhere else. A pull request gets a preview
> deployment but **must not** get the analytics flag — a preview URL is not the
> production hostname and `P21`'s runtime gate would refuse anyway; belt and
> braces.
> Fail the build if the output contains analytics code when the flag is off —
> the grep described in `P21`.
> **SPA routing**: Cloudflare Pages needs the unmatched-route rewrite for
> `/app`, `/privacy`, `/cookies`, `/terms` to survive a hard refresh —
> `public/_redirects` with `/* /index.html 200`, and `public/_routes.json` if
> any path should bypass it.
> **`public/_headers`**: a CSP that permits exactly the `P21` analytics hosts
> and the NER model host and nothing else, plus `Referrer-Policy`,
> `X-Content-Type-Options`, `Permissions-Policy` and HSTS. Long immutable
> caching for hashed assets; `no-cache` for `index.html`, `sw.js` and the
> manifest, or the service-worker fix in `P19` is undone by the CDN.
> Attach `dist-portable/index.html` to a GitHub release on tag, so the offline
> build the landing advertises is actually downloadable.
> Document the one-time manual steps — creating the Pages project, the API
> token scope, the custom domain and its DNS — in the workflow's header
> comment; they cannot be automated from a cold start and the next person will
> need them.
