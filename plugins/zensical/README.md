# @rn-cross-platform-docs/zensical

Builds a [Zensical](https://zensical.org) docs site for a React Native native module from three inputs:

- `README.md`: the home page
- `guides/`: guide pages, linked from the README as `guides/*.md`
- the Markdown API reference made by [rn-cross-platform-docs](../../README.md)
  (`typescript/`, `kotlin/`, `swift/`)

There is no config to write. The tool generates `zensical.toml` and a nav with one section per platform, and copies
the reference pages unchanged. Kotlin and Swift get each type in its own section; TypeScript keeps TypeDoc's folders
(`interfaces/`, `functions/`, ...).

The site has a header tab per platform, a light/dark toggle that follows the OS setting by default, and breadcrumbs. The
library's `package.json` supplies the site name (`name`), the meta description (`description`) and the header link to
the repo (`repository`).

## Install

The package isn't on npm, and releases don't attach tarballs yet. Until they do, build a tarball from a clone of
[rn-cross-platform-docs](https://github.com/RasmusKard/rn-cross-platform-docs) and install it from a path inside your
repo, committed, so `npm ci` finds it in CI:

```sh
cd plugins/zensical
npm ci
npm pack
# in your repo:
mkdir -p vendor && cp /path/to/rn-cross-platform-docs-zensical-*.tgz vendor/
npm install --save-dev ./vendor/rn-cross-platform-docs-zensical-*.tgz
```

Zensical runs through `uvx`, pinned to one version, so it needs [uv](https://docs.astral.sh/uv/getting-started/installation/)
on `PATH` but no Python install.

## Build

From the repo root, after `npx rn-cross-platform-docs generate`:

```sh
npx rn-cross-platform-docs-zensical build
```

| Option | Default | |
|---|---|---|
| `--reference <dir>` | `docs/reference` | The reference root, as written by `rn-cross-platform-docs generate --out` |
| `--out <dir>` | `docs-site` | The Zensical project, replaced on each run; the built site is `<out>/site/` |
| `--site-url <url>` | none | The URL the site is served from, e.g. `https://<owner>.github.io/<repo>/`. Also turns on page loads without a full reload. |

Add `<out>` to `.gitignore`. The tool refuses to write into a non-empty directory it didn't create.

To preview, serve the built site with any static server, e.g. `uv run --no-project python -m http.server -d docs-site/site`.

## Deploy to GitHub Pages

A reusable workflow runs rn-cross-platform-docs' `generate.yml`, builds the site with this package and deploys it.
It takes the same inputs as `generate.yml` except `artifact-name`, and passes them on; see the
[rn-cross-platform-docs README](../../README.md#github-actions) for the inputs. Both
packages must be devDependencies of the calling repo ([this package](#install),
[rn-cross-platform-docs](../../README.md#install)), and the repo's Pages source
must be set to GitHub Actions (Settings → Pages).

```yaml
name: Docs site
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  docs:
    uses: RasmusKard/rn-cross-platform-docs/.github/workflows/deploy-zensical.yml@main
```

## Known gaps

The site shows the reference as generated, including the gaps listed in rn-cross-platform-docs' README. On top of
those:

- Zensical reads underscores in Swift symbol names as emphasis, so `ask(_:_:_:)` shows as `ask(:_::)` in the nav,
  page title and search.
- Kotlin links to inherited members point to anchors that don't exist.
- TypeScript's `_media/` folder is left out of the nav but still built, so Zensical warns about it.
- TypeDoc's `documents/` section repeats the guides under TypeScript.
