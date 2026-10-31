# S5: Starlight (Astro) as the fallback site generator

Purpose: check by hand whether Starlight can serve the three generated trees (`spike/out/{typescript,kotlin,swift}`) unchanged, with a folder-based sidebar and Pagefind search, and find what breaks.

Result: **pass** on the acceptance checks (build, sidebar, search). Two problems the plugin must solve: every cross-page link is broken unless rewritten, and colliding slugs drop pages silently.

## Versions

| Package | Version | How |
|---|---|---|
| astro | 7.4.4 | pinned (`--save-exact`) |
| @astrojs/starlight | 0.42.8 | pinned; peer `astro ^7.2.10` |
| pagefind | 1.5.2 | transitive, from Starlight |
| github-slugger | 2.0.0 | transitive, used by Astro for ids |
| Node / npm | 26.11.1 / 11.20.0 | |

Astro 7 renders Markdown with Sätteri by default. remark and rehype plugins run only once `@astrojs/markdown-remark`, an optional peer of Starlight, is installed; without it, Astro refuses `markdown.rehypePlugins`.

## Commands from a clean state

```sh
mkdir -p spike/sites/starlight && cd spike/sites/starlight
npm init -y
npm install --save-exact astro@7.4.4 @astrojs/starlight@0.42.8
# package.json: "type": "module", scripts: dev/build/preview = astro dev/build/preview
mkdir -p src/content && ln -s ../../../../out src/content/docs   # src/content/docs -> spike/out
# write astro.config.mjs and src/content.config.ts (below)
npx astro telemetry disable
npm run build          # = astro build, output in dist/
npx astro preview      # serve dist/
```

## Config and code

`astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'react-native-minimal-webview',
      sidebar: [
        { label: 'TypeScript', items: [{ autogenerate: { directory: 'typescript' } }] },
        { label: 'Kotlin', items: [{ autogenerate: { directory: 'kotlin' } }] },
        { label: 'Swift', items: [{ autogenerate: { directory: 'swift' } }] },
      ],
    }),
  ],
});
```

`src/content.config.ts`, the only code added:

```ts
import { readFileSync } from 'node:fs';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

// src/content/docs is a symlink to spike/out (Starlight's autogenerate only sees files under src/content/docs/). Ids (routes) are Astro's default github-slugged paths.
// `!**/_*/**`: skip TypeDoc's `_media/` copies, as Starlight's own docsLoader skips `_` files; `_media/README.md` embeds an
// image TypeDoc didn't copy, and Astro fails the build on a missing image.
const trees = glob({ base: 'src/content/docs', pattern: ['{typescript,kotlin,swift}/**/*.md', '!**/_*/**'] });

// The files have no frontmatter: Starlight's required `title` comes from the first `# ` heading.
const firstHeading = (file: string) => readFileSync(file, 'utf8').match(/^# (.+)$/m)?.[1] ?? file;

export const collections = {
  docs: defineCollection({
    loader: {
      name: 'generated-markdown',
      load: (ctx) =>
        trees.load({
          ...ctx,
          parseData: (entry) =>
            ctx.parseData({ ...entry, data: { title: firstHeading(entry.filePath!), ...entry.data } }),
        }),
    },
    schema: docsSchema(),
  }),
};
```

The missing `title` is handled by wrapping Astro's `glob` loader and injecting `title` into `parseData`, so the stock `docsSchema()` validates unchanged. A remark plugin can't do this, because the collection schema is validated before Markdown is rendered. Every input file has an h1.

## Acceptance

| Check | Result |
|---|---|
| `npm run build` | passes: `133 page(s) built` (78 TypeScript + 26 Kotlin + 28 Swift + 404) |
| Sidebar lists all three trees | yes: groups TypeScript (78 links), Kotlin (26), Swift (28), counted in `dist/kotlin/index.html` |
| Search finds `WebViewContext` in every tree | yes: 10 hits (typescript 2, kotlin 5, swift 3) |
| Platform-only symbols | `createBridge` 9 hits (all TypeScript), `chromeClients` hits `/kotlin/.../-web-view-context/chrome-clients/`, `navigationDelegates` hits `/swift/.../webviewcontext/navigationdelegates/`, `MRWInvoke` hits `/swift/.../mrwinvoke_____/` |

Search was checked by serving `dist/` with `astro preview` and running the built site's own `pagefind.js` from Node (`options({ basePath })` then `search(q)`), reading each result's URL.

## Slug collisions

Ids are Astro's default: github-slugger applied to each path segment, then a trailing `/index` dropped. Computing that id for all 133 `.md` files (including `_media/`) gives **0 collisions** (133 files, 133 ids). The build agrees: 132 loaded files gave 132 doc routes, with no duplicate warning.

- The Swift tree holds a single operator page, `documentscope/end/!=(_:_:).md` (id `.../end/__`). There is no `==(_:_:).md` in this output.
- Case-only clashes (`WebViewContext.md` vs `webviewcontext.md`) can't exist on a default case-insensitive macOS volume.

The slugs are lossy, so collisions are latent. A scratch probe added copies named `!=(_:_:).md`, `==(_:_:).md`, `<(_:_:).md`, `webviewcontext.md` and `webviewcontext/index.md`:

- All operator pages map to `__`. A DocC member named `index` maps onto its parent type's page (`webviewcontext/index.md` and `webviewcontext.md` both become `webviewcontext`).
- 5 files gave 2 pages. **A cold build drops the losers silently.** Astro syncs 10 files at a time (`pLimit(10)`), so its duplicate check (`existingEntry`) races. Only a warm rebuild warns: `[WARN] [generated-markdown] **docs** contains multiple entries with the same slug: `probe/__`. Slugs must be unique.`
- The winner isn't stable: `==` won the first build, and `!=` won after it was edited.
- `prerenderConflictBehavior: 'error'` can't catch it either, because it acts on the same racy check.

Other slug effects: `ask(_:_:_:)` becomes `ask___`, `register(_:webViewClass:configure:attach:file:line:)` becomes `register_webviewclassconfigureattachfileline`, and `expo.modules.minimalwebview` becomes `expomodulesminimalwebview`. The plugin should pass its own collision-checked `generateId`.

## Numbers

Measured on an M-series Mac. Wall clock is `/usr/bin/time -p npm run build`; Astro's own figure is its `page(s) built in` line.

| | Wall clock | Astro's figure |
|---|---|---|
| Cold (`dist`, `.astro`, `node_modules/.astro`, `node_modules/.vite` removed), 3 runs | 4.45 / 2.77 / 2.87 s | 2.67 / 1.92 / 1.85 s |
| Warm, 3 runs | 2.18 / 2.24 / 2.42 s | 1.32 / 1.41 / 1.50 s |
| First build right after `npm install` | 11.1 s | |
| Search index `dist/pagefind/` | 1.3 MB (1280 KB) | |
| Total site `dist/` | 11 MB (11656 KB, 291 files) | |
| `node_modules` | 206 MB | |

Most of `dist/` is HTML: each of the 133 pages repeats the 132-link sidebar.

## Links

With the base config, **no cross-page link inside page content works**. A script resolved every internal `href` in the rendered content against the page URL and checked it against `dist/`:

| Tree | Links | Broken | Why |
|---|---|---|---|
| TypeScript | 418 relative `.md` | 418 | `.md` kept; pages are served as directories (`/typescript/type-aliases/hookevent/`), so `../README.md` resolves one level too high; slugs differ from file names |
| Kotlin | 250 relative `.md` | 250 | same, plus `expo.modules.minimalwebview` slugged to `expomodulesminimalwebview` |
| Swift | 11 absolute `/documentation/MinimalWebView/...` | 11 | no `/swift/` prefix, mixed case, and the targets are un-slugged names (`emit(_:_:)` lives at `.../emit__/`) |

Trial in a scratch copy with `astro-rehype-relative-markdown-links@0.19.2` and `@astrojs/markdown-remark@7.3.5`, config `markdown: { rehypePlugins: [[relativeLinks, { collectionBase: false }]] }`:

- TypeScript: 417 of 418 links fixed. The one left targets the excluded `../_media/README.md#requirements`.
- Kotlin: 250 of 250 links fixed.
- Swift: 11 still broken. DocC links need a small custom rehype step: drop `/documentation`, prefix `/swift/documentation`, lowercase, then github-slug each segment.

Without the `collectionBase: false` option, the plugin's links come out as `/docs/...`. Heading anchors (`#requirements`) weren't checked.

## Problems and workarounds

1. **No frontmatter titles.** Fixed by the `parseData` wrapper above.
2. **`autogenerate` matches nothing when the glob `base` is outside `src/content/docs`.** Starlight strips `src/content/docs/` from each entry's `filePath` to work out its folder. The three groups rendered empty until `src/content/docs` was made a symlink to `spike/out`. Astro keeps the symlinked path, so ids and routes are unchanged.
3. **Sidebar syntax changed in 0.39.** `{ label, autogenerate }` fails with "Support for autogenerated sidebar groups was removed in Starlight v0.39.0". The working form is `{ label, items: [{ autogenerate }] }`.
4. **A missing image fails the whole build.** TypeDoc's `_media/README.md` embeds `guides/how-it-works.svg`, which isn't in the tree, and the build stops with `[ImageNotFound] Could not find requested image guides/how-it-works.svg`. Workaround: exclude `_*/` folders, which costs one linked page (`documents/Migrating-from-react-native-webview.md` links to it). The alternative is to copy the asset into the tree in the generator.
5. **Two h1s per page.** Starlight renders `title` as an h1 and the file's own `# X` follows it. Not fixed. A remark plugin dropping the first depth-1 heading would fix it, but needs `@astrojs/markdown-remark` (see Versions).
6. **Generator chrome shows as content.** TypeDoc's `**react-native-minimal-webview**` / `***` header and Dokka's `//[...]/[...]` breadcrumb line render on top of each page. The DocC JSON metadata block is an HTML comment and stays invisible.
7. **Sidebar group labels are raw folder names**: `-document-scope`, `-c-l-o-s-i-n-g`, `documentation`, `type-aliases`. Page labels are the derived titles.
8. **Collisions are silent on cold builds.** See Slug collisions.
9. **Build-time warnings**, all harmless here: `collection "i18n" does not exist`, `Entry docs → 404 was not found`, sitemap skipped without `site`.
10. **A symlinked `node_modules` breaks the build** (`No cached compile metadata found for ".../Page.astro?astro&type=style..."`). Scratch probes used a `cp -Rc` copy instead.
