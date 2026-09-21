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

### [ ] P16 — Design pass: tokens, then the shell

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

### [ ] P17 — Light/dark theme, the "two modes"

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

### [ ] P18 — The menu: language, theme, settings

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

### [ ] P19 — Landing page and the routing split

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

### [ ] P20 — Legal: privacy, cookies, terms

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

### [ ] P21 — Consent banner and analytics, public deployment only

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

### [ ] P22 — Automated Cloudflare Pages deploy

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
