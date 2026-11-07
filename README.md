# rn-cross-platform-docs

A thin wrapper around TypeDoc, Dokka and DocC for React Native native modules: it turns each platform's doc comments
into Markdown, one folder per platform, and a site plugin turns those folders into one doc site.

```
docs/reference/
  typescript/   TypeDoc with typedoc-plugin-markdown
  kotlin/       Dokka 2, GitHub-flavored Markdown
  swift/        DocC Markdown output
```

- Site plugins: [Zensical](plugins/zensical/) (`@rn-cross-platform-docs/zensical`)
- [Example Zensical site](https://rasmuskard.github.io/rn-cross-platform-docs/) ( [Built from](examples/expo-greeter/) )

## Usage

### CLI

From the library root; Kotlin needs a JDK, Swift needs Xcode.

```sh
npm install --save-dev @rn-cross-platform-docs/cli typedoc@0.28.20 typedoc-plugin-markdown@4.14.1
(cd example && npx expo prebuild)   # Kotlin and Swift need the library buildable first; this is the Expo way
npx rn-cross-platform-docs generate
```

To build a site from the Markdown (needs [uv](https://docs.astral.sh/uv/getting-started/installation/) on `PATH`):

```sh
npm install --save-dev @rn-cross-platform-docs/zensical
npx rn-cross-platform-docs-zensical build   # the site is docs-site/site/
```

Both commands take `--help` for their options.

### GitHub Actions

Generates the reference, builds the Zensical site and deploys it to GitHub Pages. Needs both packages as dev
dependencies, and the repo's Pages source set to GitHub Actions (Settings → Pages).

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
    uses: RasmusKard/rn-cross-platform-docs/.github/workflows/deploy-zensical.yml@v1
    with:
      prepare: cd example && npx expo prebuild
```

The default install runs `npm ci`, plus `npm ci` in `example/` when it has a `package-lock.json`; with yarn or pnpm,
set the `install` input so `prepare` finds the example app's dependencies.

For the reference alone, use [`generate.yml`](.github/workflows/generate.yml) the same way: it uploads one
`api-reference-<platform>` artifact per platform, holding `<platform>.tar`. Both workflows list their inputs at the top.

## Good to know

- Swift docs build the Xcode scheme named after the podspec file, in `--xcode-workspace`.
- A DocC catalog's landing article, such as one that says who the Swift API is for, needs the pod to pass the catalog
  to DocC, since CocoaPods doesn't add a `.docc` folder: see
  [ExpoGreeter.podspec](examples/expo-greeter/ios/ExpoGreeter.podspec).
- `android/Module.md`, if there is one, is Dokka's module and package documentation. For a library with one package,
  the site leaves out Dokka's root page, so only the `# Package` section shows there.
- TypeDoc runs on your own TypeDoc config. Where it doesn't set them, the entry point is `src/index.ts(x)` and `readme`
  is `none`, so no README page is made.
- The TypeScript tree includes typedoc-plugin-markdown's `navigation.json`. The CLI overrides `out` and `navigationJson`
  from your TypeDoc config.
- Swift file names contain `:` and `!`, so Windows can't check out a committed Swift tree.
- DocC in Xcode 27 (Swift 6.4) writes no Topics in its Markdown, so the Swift landing page and type pages don't list
  their members, except the Topics a catalog article writes itself; the Zensical site's sidebar still lists them.
  [swift-docc#1625](https://github.com/swiftlang/swift-docc/pull/1625) fixes it in a later release.
- A Swift declaration that names another of the module's types is an HTML code block (`<pre><code>`), so the type can
  link to its page. GitHub and the site show it as code; the site doesn't color its syntax.
- Kotlin pages list only the members a class declares or overrides. Inherited ones, from Android and React Native base
  classes too, would otherwise fill the page with links to anchors Dokka's Markdown doesn't write.

### Zensical site

- The plugin's `uv.lock` pins Zensical and its Python dependencies, with hashes. uv installs them in its cache, from
  the URLs in the lock (files.pythonhosted.org), not from an index you configure.
- Guides are listed in the order the README links them; `guides/.nav.yml` overrides that. Site name, description and
  repo link come from `package.json`.
- Images in the README and guides from elsewhere in the library, including `<picture>` and `srcset` ones, show on the
  site too. Links there into the reference, such as `docs/reference/typescript/README.md`, open the site's page, if
  it has one; links to other repo files and folders, such as `LICENSE` or `example/`, open them in the repo
  (`repository` in `package.json`).
- The TypeScript nav is typedoc-plugin-markdown's navigation, so TypeDoc's grouping, category and sorting options and
  its `navigation` options shape it.
- Swift deprecation doesn't show: DocC only writes it in a metadata comment.
- TypeDoc's headings inside a member, such as Parameters, each parameter's name, Returns and Example, become bold
  labels, so search lists each member once, with its parameters, return value and examples.
- If TypeDoc also copies the guides (`documents/`), those copies stay out of the nav, but search lists each guide twice
  and their links outside `guides/` break.
