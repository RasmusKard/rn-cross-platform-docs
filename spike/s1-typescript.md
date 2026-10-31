# S1: TypeScript to Markdown

Purpose: record the exact commands that turn `~/minimal-rn-webview`'s TypeScript API (`src/index.ts`) into Markdown with TypeDoc, for the phase-2 generator to reproduce.

## Versions

| Tool | Version | Source |
| --- | --- | --- |
| typedoc | 0.28.20 | already in the repo (`devDependencies`, pinned exact) |
| typedoc-plugin-markdown | 4.14.1 | latest; peer `typedoc: 0.28.x` |
| tsdoc-defaults | 0.1.0 | already in the repo |
| node | 26.11.1 | |

## Commands

Run from any directory. `W` is a throwaway copy; the repo itself is never written.

```sh
W=/private/tmp/s1-webview            # any path that does not exist yet
cp -Rc ~/minimal-rn-webview "$W"     # APFS clone, includes node_modules
(cd "$W" && npm install --no-save --ignore-scripts typedoc-plugin-markdown@4.14.1)
cp ~/rn-cross-platform-docs/spike/typedoc.markdown.json "$W/.config/"
(cd "$W" && npx typedoc --options .config/typedoc.markdown.json --out ~/rn-cross-platform-docs/spike/out/typescript)
rm -r ~/rn-cross-platform-docs/spike/out/typescript/assets   # only holds the HTML theme's custom.css
node ~/rn-cross-platform-docs/spike/s1-exports.mjs ~/minimal-rn-webview ~/rn-cross-platform-docs/spike/out/typescript
```

The install needs network access and takes a few minutes, because npm reinstalls the workspace. `--ignore-scripts` skips the repo's `prepare` build.

`spike/typedoc.markdown.json`, which is copied next to the repo's config so that `extends` and the relative plugin paths resolve the same way as in `.config/typedoc.json`:

```json
{
  "$schema": "https://typedoc-plugin-markdown.org/schema.json",
  "extends": ["./typedoc.json"],
  "plugin": ["tsdoc-defaults/typedoc", "typedoc-plugin-markdown"],
  "readme": "none"
}
```

- `plugin` replaces the inherited array: it keeps `tsdoc-defaults/typedoc` and drops the repo plugin (see [Plugin findings](#plugin-findings)).
- `readme: "none"` makes `README.md` the API index. Otherwise the repo README becomes the entry page, and it links to the HTML site (`.../modules.html`).

TypeDoc output: three `[info]` lines and `markdown generated at ...`, exit 0, no warnings under `treatWarningsAsErrors: true`.

## Export coverage

`spike/s1-exports.mjs` lists the exports of `src/index.ts` with the repo's own `typescript` (so `export * from './types'` is expanded). For each export it finds the pages whose breadcrumb reads `<project> / <export>`, which marks a page for that top-level export. It exits 1 if any export has no page.

Result: `47 exports, 0 missing`, exit 0. `WebView` has two pages: `functions/WebView.md` (the component) and `react-native-minimal-webview/namespaces/WebView/README.md` (the merged namespace holding `android.*` and `defaultNavigationRules`). An earlier version of the check matched on the `# Kind: Name` heading. It reported 6 false misses (generic titles like `Bridge\<Methods, Events\>` and namespace pages titled with the bare name), so that matching approach is unreliable.

## Plugin findings

Each was compared by diffing the Markdown output with no plugin, with only the repo plugin, and with only tsdoc-defaults.

### `.github/scripts/typedoc-plugin.mts`

- Hiding `const` on variables works: `> `const` **x**` becomes `> **x**`.
- Moving `@android`/`@ios` from a function's signature to the function is harmful in Markdown. typedoc-plugin-markdown renders a function page from its signature comment only, so the moved tag disappears. It drops the `**`Android`**` line from `WebView.android.warmUp`, `preconnect` and `setWebContentsDebuggingEnabled`.
- The `PageEvent.END` rewrites do nothing in Markdown. They are regexes over HTML theme markup (`<code class="tsd-tag">`, `<h4 class="tsd-returns-title">`, `<h3 class="tsd-anchor-link">`). They match nothing, so no SVG icons or HTML get injected (there is no `<svg`, `tsd-` or `class="` anywhere in the output). The intended effects are also missing:
  - The Optional pill stays as `` `optional` **name?** ``.
  - `## Returns` headings stay when there is no `@returns` text.
  - Platform tags render as text, not icons.
- Decision: drop it for Markdown. To keep the `const` hiding, the phase-2 generator should reimplement that one hook (`EVENT_RESOLVE_BEGIN`, clear `ReflectionFlag.Const` on variables).

### `tsdoc-defaults/typedoc`

Works as intended in Markdown. A code-span `@default` becomes the signature default, for example `` > `optional` **timeoutMs?**: `number` = `10000` ``, and the separate `#### Default` block is removed. Without the plugin, the default still shows, as a `#### Default` section. Keep it.

### Platform tag labels

typedoc-plugin-markdown builds modifier-tag labels with `camelToTitleCase(tag)` and ignores `locales.en.tag_ios`. So `@ios` renders as `` **`Ios`** `` (9 files) and `@android` as `` **`Android`** `` (11 files). Fixing `Ios` to `iOS` needs a post-process or a theme override.

## Repo options and Markdown

TypeDoc reported no warning or error for any inherited option. Effect of each in Markdown:

| Option | Effect in Markdown | Action |
| --- | --- | --- |
| `customCss` | still copied by TypeDoc core's AssetsPlugin to `<out>/assets/custom.css` | delete `<out>/assets` after the run. Cannot be unset: `"customCss": ""` resolves to the config's directory, and the whole `.config/` directory gets copied as `assets/custom.css`. |
| `readme` | repo README becomes the entry page | override with `"none"` |
| `headings`, `visibilityFilters`, `navigationLinks`, `highlightLanguages`, `searchInComments`, `customCss` styling | HTML theme only; not read by the markdown plugin | ignore |
| `navigation`, `includeHierarchySummary` | read only for the navigation JSON or hierarchy pages; no visible effect here | ignore |
| `locales` | read, but not used for modifier-tag labels | ignore |
| `useFirstParagraphOfCommentAsSummary` | no effect observed (index lists carry no summaries) | ignore |
| `entryPoints`, `disableSources`, `excludeExternals`, `validation`, `groupOrder`, `@groupDescription`, `@document`, `treatWarningsAsErrors` | apply: no "Defined in" lines, groups in the repo's order with descriptions, 4 guides under `documents/` | keep |

## Problems and workarounds

- Running against the repo in place with a separate TypeDoc install fails:
  - `--plugin tsdoc-defaults/typedoc` gives `[error] The plugin tsdoc-defaults/typedoc could not be loaded` / `Cannot find package 'tsdoc-defaults' imported from .../s1-tools/node_modules/typedoc/dist/node-utils.js`.
  - With its absolute path, you get `[warning] TypeDoc has been loaded multiple times ...` (the plugin imports the repo's TypeDoc copy), and `treatWarningsAsErrors` turns it into exit 1.
  - Workaround: install the markdown plugin into a clone of the repo, so it shares the repo's TypeDoc.
- Namespace pages land under `react-native-minimal-webview/namespaces/...` while everything else is at the top level (`functions/`, `type-aliases/`, ...). This comes from the plugin's router: for a namespace whose parent is the project, the directory is built from the project name. `--router module` puts them in the same place. Links are consistent, so it is cosmetic.

## For the phase-2 generator

- Get TypeDoc from the target repo's `node_modules`, and add typedoc-plugin-markdown next to it in a clone. Check that the repo's typedoc matches the plugin's peer range (`0.28.x` for 4.14.1).
- Generate the options file next to the repo's config (or rewrite relative paths). Replace `plugin` with an explicit list: keep known-safe plugins (tsdoc-defaults), drop plugins that post-process HTML or move signature tags, set `readme: "none"`.
- Delete `<out>/assets` after the run.
- Optionally post-process the `` **`Ios`** `` labels.
- Guides from `@document` are copied as-is. Their links to the HTML site (`rasmuskard.github.io/.../*.html`) and to `../README.md` stay. The README link is copied as `_media/README.md`.
- Coverage check: compare `checker.getExportsOfModule` with page breadcrumbs, not with page titles.
- `.config/typedoc-extensions.json` (the `extensions` sub-package) was not covered.
