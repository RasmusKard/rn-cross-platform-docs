# S4: Zensical site from the three Markdown trees

Purpose: record the exact commands and config that build one Zensical site from the S1 (TypeScript), S2 (Kotlin) and S3 (Swift) Markdown trees, with the nav built by awesome-nav, for the phase-3 site plugin to reproduce.

Result: **pass**. `uvx zensical@0.0.74 build` exits 0, the nav lists all three trees, and `search.json` holds `WebViewContext` from each tree plus one symbol specific to each platform. The generated Markdown is copied byte for byte (`diff -r` against `out/` is clean).

## Versions

| Tool | Version | Why |
|---|---|---|
| zensical | 0.0.74 | Latest on 2026-10-31 (released 2026-10-30). awesome-nav support has been built in since 0.0.58. Zensical ships weekly, so the plugin should pin one version and bump it on purpose. |
| zensical-ui | 0.0.41 | Pinned exactly by zensical 0.0.74 |
| Python | 3.12.13 (uv-managed) | Picked by `uvx` itself. With no Python on the machine (`--managed-python`, empty install dir), uv downloaded CPython 3.14.7 and the build worked |
| uv | 0.12.5 | |

Not pinned: zensical's other dependencies are lower bounds only (`markdown>=3.7`, `pymdown-extensions>=11.0`, …). This run resolved Markdown 3.11.2 and pymdown-extensions 12.3. To freeze them, `uvx --exclude-newer 2026-10-31T00:00:00Z zensical@0.0.74 build` works (tested).

## awesome-nav in Zensical

Zensical supports it, but not by loading the `mkdocs-awesome-nav` package. It has its own Rust copy of it (`crates/zensical/src/compat/mkdocs/plugin/awesome_nav*.rs`, added in 0.0.58 as "add `awesome-nav` MkDocs plugin replacement"), so nothing extra is installed. The plugin is turned on just by being listed, and accepts only the options `enabled`, `filename` (default `.nav.yml`) and `logs` (`python/zensical/config.py`). It reads `.nav.yml` with these keys: `title`, `hide`, `nav`, `sort`, `ignore`, `append_unmatched`, `flatten_single_child_sections`, `preserve_directory_names`, `use_index_title`.

Plugins Zensical doesn't know are silently dropped (`_convert_plugins`: `if canonical not in _PLUGIN_UNSUPPORTED_OPTIONS: return`). So each setting was checked by building with and without it:

| Setting | Without it | With it |
|---|---|---|
| `plugins.awesome-nav` | nav: `react-native-minimal-webview API reference`, `Kotlin`, `Swift`, `Typescript` (alphabetical, folder names) | nav: `Home`, `TypeScript`, `Kotlin`, `Swift` (as in `docs/.nav.yml`) |
| `theme.features = ["navigation.indexes"]` | each `index.md` / `README.md` shows as a separate child page | it becomes the section's link (`md-nav__container`) |
| `pymdownx.escapeall.hardbreak` | literal `\` in 14 TypeScript pages (`HookEvent\<N, P>`, in titles, nav and search too) and after `[androidJvm]` in 24 Kotlin pages | `HookEvent<N, P>`; `[androidJvm]<br />`. Only those 38 pages change (article HTML diffed) |
| `.nav.yml` `use_index_title: true` | | **no effect**: it reads only a front-matter `title`, and none of the trees has front matter |

## Commands (from a clean state)

```sh
SPIKE=~/rn-cross-platform-docs/spike
Z=$SPIKE/sites/zensical
mkdir -p "$Z/docs"
for t in typescript kotlin swift; do cp -R "$SPIKE/out/$t" "$Z/docs/$t"; done
# write $Z/zensical.toml, $Z/docs/.nav.yml, $Z/docs/index.md (below)
cd "$Z" && uvx zensical@0.0.74 build      # writes site/ and .cache/ next to zensical.toml
```

`site_dir` must be inside the project root (`Error: site_dir must be within project root`). `-c/--clean` clears `.cache/`. `--strict` exits 1 (`RuntimeError: Aborted because --strict flag is set`) because of the 31 warnings below. `NO_COLOR=1` does not turn off the ANSI colors in the warnings.

## Config files

`zensical.toml`:

```toml
[project]
site_name = "react-native-minimal-webview"
site_url = "https://example.com/"

[project.theme]
features = ["navigation.indexes"]

# Zensical's built-in awesome-nav replacement; reads docs/**/.nav.yml
[project.plugins.awesome-nav]

# Zensical's default extension set (setting this table replaces it), plus escapeall
[project.markdown_extensions]
abbr = {}
admonition = {}
attr_list = {}
def_list = {}
footnotes = {}
md_in_html = {}
toc.permalink = true
pymdownx.arithmatex.generic = true
pymdownx.betterem = {}
pymdownx.caret = {}
pymdownx.details = {}
pymdownx.emoji.emoji_generator = "zensical.extensions.emoji.to_svg"
pymdownx.emoji.emoji_index = "zensical.extensions.emoji.twemoji"
pymdownx.highlight.anchor_linenums = true
pymdownx.highlight.line_spans = "__span"
pymdownx.highlight.pygments_lang_class = true
pymdownx.inlinehilite = {}
pymdownx.keys = {}
pymdownx.magiclink = {}
pymdownx.mark = {}
pymdownx.smartsymbols = {}
pymdownx.superfences.custom_fences = [
  { name = "mermaid", class = "mermaid", format = "pymdownx.superfences.fence_code_format" },
]
pymdownx.tabbed.alternate_style = true
pymdownx.tabbed.combine_header_slug = true
pymdownx.tasklist.custom_checkbox = true
pymdownx.tilde = {}
# CommonMark escapes: TypeDoc's \< and Dokka's trailing-backslash line breaks
pymdownx.escapeall.hardbreak = true
```

The extension list is a copy of `DEFAULT_MARKDOWN_EXTENSIONS` in `config.py` (the same as `zensical new` writes). `toc` and `tables` are always added on top of it.

`docs/.nav.yml`:

```yaml
nav:
  - Home: index.md
  - TypeScript: typescript
  - Kotlin: kotlin
  - Swift: swift
```

`docs/index.md`:

```markdown
# react-native-minimal-webview API reference

- [TypeScript](typescript/README.md)
- [Kotlin (Android)](kotlin/index.md)
- [Swift (iOS)](swift/documentation/minimalwebview.md)
```

## Acceptance

- Build: exit 0, `31 issues found`, `Build finished in 1.11s`.
- Nav: `Home`, `TypeScript`, `Kotlin`, `Swift`. All 134 Markdown files became pages (78 + 1 `_media` TypeScript, 26 Kotlin, 28 Swift, 1 home).
- Search (`site/search.json`, `{config, items}`, 1105 items). Each term was looked up in `title`/`text` of the items under its tree:

| Term | Tree | Hits | First hit |
|---|---|---|---|
| `WebViewContext` | typescript | 5 | `typescript/documents/Native-hooks/#3-register-the-hook-on-ios` (guide text; no TS export has this name) |
| `WebViewContext` | kotlin | 21 | `kotlin/.../expo.modules.minimalwebview/#types` |
| `WebViewContext` | swift | 5 | `swift/documentation/minimalwebview/webviewcontext/` |
| `useWebViewState` | typescript | 8 | `typescript/#navigation` |
| `chromeClients` | kotlin | 4 (0 in swift) | `kotlin/.../-web-view-context/chrome-clients/` |
| `uiDelegates` | swift | 2 (0 in kotlin) | `swift/documentation/minimalwebview/webviewcontext/uidelegates/` |

## Numbers

| What | Value |
|---|---|
| First run, empty uv cache (downloads zensical + zensical-ui, about 17 MB) | 22.7 s wall |
| First run, no Python at all (uv downloads CPython 3.14.7 too) | 12.1 s wall (network-bound; varies) |
| Cold build (`rm -rf site .cache`, uv cache warm) | 1.1–1.4 s wall (Zensical reports 0.85–1.11 s) |
| Warm build (unchanged inputs) | 0.67–0.91 s wall (Zensical reports 0.36–0.54 s) |
| Search index | `site/search.json`, 416,035 bytes (59,848 gzipped) |
| Total site | 14 MB (14,304 KB), 147 files: assets 528 KB, typescript 7.9 MB, kotlin 2.4 MB, swift 2.6 MB |
| `.cache/` | 15 MB |

Pages average about 100 KB each because every page embeds the whole sidebar (134 entries).

## Warnings Zensical prints

31 warnings, all known from S1 and S2:
- 16 × `anchor does not exist`, in 4 Kotlin enum pages (`-document-scope/-end/index.md` and its 3 entries). These are Dokka's dead `index.md#-372974862%2FProperties%2F1313118436` anchors for inherited `name`/`ordinal`.
- 15 × `page does not exist`, all in `typescript/_media/README.md` (TypeDoc's copy of the repo README). It links to `guides/*.md`, which isn't in the tree.

Swift's broken absolute links get **no** warning.

## Links and odd file names

Every internal `<a href>` inside `<article>` across `site/` was checked, by resolving the file and the `id` of any `#anchor` (a throwaway script, `/private/tmp/claude-502/-Users-rasmus-kard/6023b6e8-476f-4b8b-a729-5fc1c9e3e8e2/scratchpad/linkcheck.py`):

| Tree | Relative OK | Broken | External |
|---|---|---|---|
| typescript | 1774 | 15 pages (the `_media` README above) | 59 |
| kotlin | 275 | 16 anchors (above) | 113 |
| swift | 65 (all in-page `#` permalinks) | 11 pages: every DocC `/documentation/...` link | 1 |

- `-` prefixes (Kotlin): the URLs keep the name (`.../-web-view-context/clients/`), and the links resolve. In the nav and search breadcrumbs, folder names become titles: `document scope`, `web view context`, `end`, `c l o s i n g`, with a leading space in the search `path` (`' document scope'`). The package level shows as `Expo.modules.minimalwebview`.
- `(`, `)`, `:`, `!`, `=` (Swift): pages are written to `ask(_:_:_:)/index.html` and `!=(_:_:)/index.html`. The nav uses `./ask(_:_:_:)/` (the `./` stops `:` being read as a scheme), and the sitemap has it unencoded. A local `http.server` returns 200 for the raw path and for `ask%28_%3A_%3A_%3A%29/`.
- Underscores in Swift titles are read as emphasis. `# MRWInvoke(_:_:_:_:_:)` renders as `MRWInvoke(<em>:_:</em>:_:_:)`, and the nav and search title become `MRWInvoke(:_::_:_:)`. Same for `ask(_:_:_:)` → `ask(:_::)`. `pymdownx.betterem` is already on and doesn't stop it. This was not fixed.
- DocC absolute links: `[emit(_:_:)](/documentation/MinimalWebView/WebViewContext/emit(_:_:))` is passed through unchanged as `href="/documentation/MinimalWebView/WebViewContext/emit(_:_:)"`, which returns 404: wrong prefix (`swift/`), wrong case, no trailing `/`. The `doc://org.cocoapods.MinimalWebView/...` links in callouts stay as code spans.
  - Tested fix: `[project.plugins.redirects.redirect_maps]` with `"documentation/MinimalWebView/WebViewContext/emit(_:_:).md" = "swift/documentation/minimalwebview/webviewcontext/emit(_:_:).md"`. This writes `site/documentation/MinimalWebView/WebViewContext/emit(_:_:)/index.html`, a redirect to the real page.
  - It only works when the site is served at the domain root, not under a path such as a GitHub Pages project site.
- Other content passes through: DocC's metadata `<!-- {...} -->` stays in the HTML as a comment and is not in the search index. `> Important:` stays a blockquote. `package-list` and `MinimalWebView-markdown-manifest.json` are copied as static files.

## Nav shape problems (the generated Markdown is not edited)

Built from folders alone, the nav is complete but clumsy:
- Kotlin section titles come from folder names (see above). `use_index_title` doesn't help (no front matter).
- Swift puts each type page next to a folder of the same name. The nav shows both: `MinimalWebView` (page) and `Minimalwebview` (section), and `WebViewContext` (page) and `Webviewcontext` (section). Also, `documentation` is an extra level.
- TypeScript's `_media/` shows as a `media` section.

Fixes tested with `.nav.yml` files next to the trees (each worked, then was removed to keep the baseline):
- `kotlin/.../-web-view-context/.nav.yml`: `title: WebViewContext` → the section is titled `WebViewContext`.
- `swift/documentation/minimalwebview/.nav.yml`:
  ```yaml
  nav:
    - WebViewContext:
      - webviewcontext.md
      - "webviewcontext/*.md"
    - "*"
  ```
  → one `WebViewContext` section with the type page first, then its members, and no separate `Webviewcontext` folder.
- `typescript/.nav.yml`: `ignore: "_*"` → `media` leaves the nav. The page is still built.

## What the phase-3 plugin must generate

1. `zensical.toml` as above, with a real `site_name`/`site_url`. Keep the whole extension table: setting `markdown_extensions` drops Zensical's defaults.
2. `docs/<platform>/`: plain copies of the generated trees. Plus `docs/index.md` and a root `docs/.nav.yml` that orders and titles the platforms.
3. Run `uvx zensical@<pinned> build`, optionally with `--exclude-newer <date>`. Don't use `--strict` until the 31 upstream warnings are gone, or filter on warning type. `site/` and `.cache/` land next to `zensical.toml` and must be gitignored.
4. Kotlin: one `.nav.yml` per type and enum-entry folder with `title:` set to the `# H1` of its `index.md`. Also titles for the module and package folders.
5. Swift: `.nav.yml` files that group `<type>.md` with `<type>/*.md` (pattern above), going down the tree (types, then `documentscope/end`). Optionally flatten the `documentation/` level. Membership comes from the DocC identifier path (S3).
6. Swift absolute links: a `redirects.redirect_maps` entry per DocC page. Build it from the manifest `documents[].identifier`: `/documentation/M/T/m` → `swift/documentation/m/t/m.md`. Or document that these links break. Redirects only work when the site is at the domain root.
7. TypeScript: `ignore: "_*"` (or another decision for `_media`).
8. Unsolved at site level, needs a fix upstream or a decision: underscore emphasis in Swift symbol titles, and the Kotlin dead inherited anchors.

## Files

- Site: `spike/sites/zensical/` (`zensical.toml`, `docs/`, `site/`, `.cache/`)
- Zensical source read: the PyPI sdist `zensical-0.0.74.tar.gz` (`python/zensical/config.py`, `crates/zensical/src/compat/mkdocs/plugin/awesome_nav/`)
