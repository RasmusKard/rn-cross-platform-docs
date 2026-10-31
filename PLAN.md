# Orchestrator brief: rn-cross-platform-docs

You coordinate agents that build `rn-cross-platform-docs`. Run the tasks below in dependency order, in parallel where
marked, and stop at each checkpoint to report to the human. Every subagent prompt you write must carry the context its
task needs from this brief; subagents don't see it.

## Goal

A tool that turns a React Native native module repo (TypeScript + Kotlin + Swift) into Markdown API reference, one tree
per platform. A separate site plugin turns that Markdown into a docs site.

| Package | Repo | Job |
|---|---|---|
| `rn-cross-platform-docs` | https://github.com/RasmusKard/rn-cross-platform-docs (local: `~/rn-cross-platform-docs`) | Core CLI: sources to Markdown. No docs-site logic. |
| `@rn-cross-platform-docs/zensical` | Separate repo, created at checkpoint 2 | Site plugin: Zensical config, build, GitHub Pages deploy |

## Fixed decisions

Don't revisit these; raise a conflict at the next checkpoint instead.

- **Markdown only.** No static HTML output for any platform, DocC included.
- **Output layout:** `<out>/typescript/`, `<out>/kotlin/`, `<out>/swift/`.
- **Generators:**
  - TypeScript: `typedoc` with `typedoc-plugin-markdown`, extending the repo's `typedoc.json` if present. Both are
    peer dependencies of the tool, so the tool, the repo's TypeDoc plugins and the markdown plugin load one TypeDoc.
  - Kotlin: Dokka 2 with its GFM plugin, applied through a Gradle `--init-script` to the example app's Android project,
    so the package's build files stay untouched. Dokka 2's Gradle plugin no longer ships GFM by default; the
    GFM artifacts are still published (see the `plugin-gfm` README in github.com/Kotlin/dokka). Fallback: dokka-mkdocs
    (`dev.opensavvy.dokka-mkdocs`).
  - Swift: `pod install` in the example app's iOS project, then `xcodebuild docbuild` passing DocC
    `--enable-experimental-markdown-output --enable-experimental-markdown-output-manifest`. The iOS code is a pod, not a
    Swift package, so `swift package generate-documentation` doesn't apply. Fallback: emit the symbol graph and run
    `xcrun docc convert` with the same flags.
- **Expo modules and bare React Native libraries.** Kotlin and Swift compile only inside the repo's example app,
  because Dokka and DocC run the compiler and need the dependencies resolved. The setups differ only in how that app's
  native projects come to exist: an example app without committed `android/` or `ios/` (Expo) gets
  `npx expo prebuild`; a bare one uses its committed projects. New Architecture codegen runs inside the normal Gradle
  build and `pod install`.
- **Detection, no config by default:** read `package.json` (including `codegenConfig`), `expo-module.config.json` or
  `react-native.config.js` when present, the podspec, `android/build.gradle` and the example app path.
- **Public API only**, one build per platform. Language visibility draws the line. Package authors hide symbols that are
  public only because Expo or the React Native bridge requires it with `@_documentation(visibility: internal)` (Swift)
  and `@suppress` (KDoc). No internal reference.
- **Accept DocC's Markdown as is, except links.** One rewrite turns DocC's absolute mixed-case symbol links into
  relative `.md` links (via the manifest) and points image paths at the archive root; no other fix-ups. Other known
  gaps (Xcode 27.2): type pages without member lists, overloads sharing a title and differing by a hash in the file
  name, deprecation only in the metadata comment, no `swift` tag on declarations, `> Note:` left as a blockquote, file names with `(`, `)`, `:`, `!`, `=` (Windows and
  `actions/upload-artifact` reject `:`).
- **Pin tool versions:** Xcode, Dokka, TypeDoc (`0.28.x` peer range), typedoc-plugin-markdown (exact peer version),
  Zensical.
- **Work in place, no copy.** The tool runs in the library repo what its developers already run there (`expo prebuild`,
  `pod install`, Gradle) and installs nothing at generate time; the README lists those commands.
- **Site plugin uses Zensical:** pin its exact version (pre-1.0, weekly releases); run it through `uvx zensical` so users
  never install Python 3.11+; generate a fixed config (it silently ignores unsupported plugins); build nav from folders
  with awesome-nav. No fallback in v1.
- **The core knows no site generator.** Its output is plain Markdown trees plus each generator's own manifest, checked
  on their own. Phase 2 briefs don't mention Zensical or any site tool; whatever a site needs (nav files, config) the
  site plugin generates.
- **CI:** the iOS step runs on macOS, the rest on Ubuntu.

## Rules for every agent

- Don't modify `~/minimal-rn-webview`. Spike work happens in a scratch copy or reads it in place; outputs go outside it.
- No `git push`, PR, npm publish, repo creation or org change without the human's approval at a checkpoint. Local
  commits on a feature branch in `~/rn-cross-platform-docs` are fine.
- Commits: Conventional Commits subject (`feat: …`, `test: …`), subject line only, no AI attribution lines.
- Branch names: `<few-word-description>`, lowercase, dash-separated.
- Report outcomes as observed: paste the failing command and its error. A task that fails its acceptance check is not
  done.

## Tasks

### Phase 1: spike (by hand, no tool code)

Target: `~/minimal-rn-webview` (GitHub: RasmusKard/react-native-minimal-webview). Its public native API is small:
`MinimalWebViewHooks`, `WebViewContext`, `DocumentScope` and `MinimalWebViewModule` on each platform. Its example app is
in `example/`. Its CI already runs `npx expo prebuild --platform android` and Gradle (`.github/workflows/kotlin.yml`).

Write each task's exact commands to `~/rn-cross-platform-docs/spike/<task>.md`, so phase 2 can turn them into code.

| ID | Task | Depends on | Accept when |
|---|---|---|---|
| S1 | TypeScript to Markdown | none | `typescript/` holds pages for every export in `src/index.ts`. Note what its custom TypeDoc plugin (`.github/scripts/typedoc-plugin.mts`) and `tsdoc-defaults/typedoc` do or fail to do with Markdown output. |
| S2 | Kotlin to Markdown via init script | none | `kotlin/` holds pages for the four public types, minus those marked `@suppress`; no file in the package changed. If the init script can't apply GFM, try the fallback and say why. |
| S3 | Swift to Markdown via `xcodebuild docbuild` | none | `swift/` holds `.md` pages for the public types plus the manifest. If `docbuild` rejects the flags, try the fallback and say why. |
| S4 | Zensical site from S1–S3 | S1, S2, S3 | `uvx zensical build` succeeds; nav lists all three trees; search finds a symbol from each. Record build time and search index size. |
| S5 | Same site with Starlight | S1, S2, S3 | Same checks as S4, plus whether operator file names collide. Record build time and search index size. |
| S6 | Bare library: S2 and S3's commands on a fresh `create-react-native-library` scaffold (Turbo module, Kotlin + Swift, committed example app), created outside both repos | S2, S3 | `kotlin/` and `swift/` hold pages for its public types; the commands differ from S2/S3 only in the host-app step. Record the scaffold command and version. |

S1, S2 and S3 run in parallel; S4, S5 and S6 run in parallel.

**Checkpoint 1.** Report to the human: what worked, every fallback used, the S4/S5 numbers, and any fixed decision the
spike contradicts. Wait for approval before phase 2.

### Phase 2: core CLI in `~/rn-cross-platform-docs`

| ID | Task | Depends on | Accept when |
|---|---|---|---|
| C1 | Package skeleton: TypeScript npm package with a `rn-cross-platform-docs` bin, test runner, lint | checkpoint 1 | `npx rn-cross-platform-docs --help` runs from a local install |
| C2 | Stack detection | C1 | Unit tests over small fixture repos: an Expo module with all three platforms, one without iOS, a bare library, a repo with no native module (clear error) |
| C3 | TypeScript generator | C1 | Matches S1 output on the fixture |
| C4 | Kotlin generator | C1 | Matches S2 output; package build files untouched |
| C5 | Swift generator, including the link rewrite | C1 | Matches S3 output, except every symbol link and image path resolves to a file in the tree (unit test plus a check over the S3 tree) |
| C6 | `generate` command: `--out` (default `docs/reference`) and `--platforms` (default: detected), so CI can run one platform per runner | C2–C5 | One run on minimal-rn-webview reproduces the spike's three trees; one run on S6's bare library reproduces its trees |
| C7 | Reusable GitHub workflow: Swift job on macOS, TypeScript and Kotlin on Ubuntu, one merged Markdown artifact. Tar the Swift tree before upload. | C6 | Runs green against a fork or test repo that calls it |
| C8 | README: what the tool is, install, `generate`, the workflow, the DocC limitations, how to hide symbols that are public only because the framework requires it | C6, C7 | Every command in it runs as pasted |

C3, C4 and C5 run in parallel after C1; C2 too.

**Checkpoint 2.** Report results. Ask the human to create the plugin repo and the npm org, and to approve pushing.

### Phase 3: Zensical plugin (separate repo)

| ID | Task | Depends on | Accept when |
|---|---|---|---|
| Z1 | `@rn-cross-platform-docs/zensical`: generates a pinned Zensical config from the package's README, `guides/` and the reference tree, then builds | checkpoint 2 | Builds minimal-rn-webview's site with no hand-written config |
| Z2 | Reusable deploy workflow to GitHub Pages, consuming C7's artifact | Z1, C7 | Deploys a test site |

**Checkpoint 3.** Report results. The human decides when to adopt the tool in minimal-rn-webview, which replaces its
TypeDoc HTML setup and loses its platform icons and iOS/Android filter toggles.

## Out of scope

DocC fix-ups beyond the link rewrite, versioned docs, internal or contributor reference, hubs combining several repos, React Native apps
(only library repos with an example app), a Starlight plugin, excluding generated code (e.g. Nitro's) from the reference;
the README notes that it shows up.

## Open questions for the human

Raise these at checkpoint 1 with what the spike showed:

- ~~Rewrite DocC's symbol links~~: yes, in the core (checkpoint 1).
- ~~Where the reusable workflows live~~: one each, as above (checkpoint 1).
