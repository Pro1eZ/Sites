# Sites
Public web pages for applications.

## Website brand

`brand.css` is the shared source for TrailRig purple: **#8C52FF**, RGB **140, 82, 255**.
All current pages load `/brand.css` (including `/b/` and the 404 fallback).
Use `var(--purple, #8C52FF)` for solid accents and
`rgba(var(--brand-purple-rgb, 140, 82, 255), alpha)` for tints.
Both purple gradient endpoints intentionally share the canonical base.
Theme metadata and inline fallbacks must also stay canonical. Do not recolor
semantic sale/stolen/status colors, partner/Apple assets, screenshots, or historical release prose.

### Local regression tests

Use Node 22.22.2+, 24.15.0+, or 26+ (see `package.json`), then:

```sh
npm ci
npm test
```

Tests load actual HTML, linked local CSS, and page scripts in jsdom, asserting
computed colors, gradients, alpha tints, keyboard focus, metadata, resource paths,
stylesheet-failure fallbacks, bike/status renderer branches, and script syntax.
Only API/network responses are mocked; no production dependencies or build step are added.
