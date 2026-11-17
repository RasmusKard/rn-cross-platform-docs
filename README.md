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

The site's home page is the library's `README.md`. The pages in `guides/`, if there is one, follow in the order the
README links them, a folder of guides where its first linked guide is; `guides/.nav.yml` overrides that. Site name,
description and repo link come from `package.json`.

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
    uses: RasmusKard/rn-cross-platform-docs/.github/workflows/deploy-zensical.yml@v2
    with:
      prepare: cd example && npx expo prebuild
```

The default install runs `npm ci`, plus `npm ci` in `example/` when it has a `package-lock.json`; with yarn or pnpm,
set the `install` input so `prepare` finds the example app's dependencies.

For the reference alone, use [`generate.yml`](.github/workflows/generate.yml) the same way: it uploads one
`api-reference-<platform>` artifact per platform, holding `<platform>.tar`. Both workflows list their inputs at the top.

## Good to know

- **TypeScript:** Without `entryPoints` in your TypeDoc config, TypeDoc documents `src/index.ts(x)`.
- **Kotlin:** Write module and package documentation in `android/Module.md`, in Dokka's format, as the example's
  [Module.md](examples/expo-greeter/android/Module.md) does.
- **Kotlin:** Pages list the members a class declares or overrides, not the ones it inherits.
- **Swift:** To show a DocC catalog's landing article, list the catalog's files in the podspec's `source_files`, as
  [ExpoGreeter.podspec](examples/expo-greeter/ios/ExpoGreeter.podspec) does.
- **Swift:** With Xcode 27, a type's page doesn't list its members, and the landing page lists only the Topics a
  catalog writes; the site's sidebar still lists them all.
  [swift-docc#1625](https://github.com/swiftlang/swift-docc/pull/1625) fixes it in a later release.
