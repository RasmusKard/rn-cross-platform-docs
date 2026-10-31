# S2: Kotlin to Markdown via a Gradle init script

Purpose: generate the Kotlin public API reference of an Expo module as GitHub-flavored Markdown with Dokka 2, applied
through `--init-script` to the example app's prebuilt Android project, without touching the package's build files.

## Versions

| Tool | Version |
|---|---|
| Dokka (Gradle plugin, `gfm-plugin`, `gfm-template-processing-plugin`) | 2.2.0 (pinned in the init script; latest release on 2026-10-31) |
| JDK | Zulu 17.0.20.1 |
| Gradle (example app wrapper) | 9.4.1 |
| AGP / Kotlin (from react-native's `libs.versions.toml`) | 9.2.1 / 2.2.0, with `android.builtInKotlin=false`, `android.newDsl=false` |
| Expo / React Native (example app) | 58.0.19 / 0.88.0 |

## Init script

`spike/dokka-gfm.init.gradle` (Groovy; a Kotlin DSL version can't work, see Problems):

```groovy
// Applies Dokka 2 with the GFM (Markdown) format to one subproject, leaving its build files untouched.
// Usage: ./gradlew --init-script dokka-gfm.init.gradle -PdokkaProject=:<name> :<name>:dokkaGenerateMarkdown
def dokkaVersion = '2.2.0'
def target = gradle.startParameter.projectProperties['dokkaProject']

// Dokka must share a classloader with AGP and KGP to find the Android sources, so it goes on the root buildscript
// classpath; from the init script's own classpath it can't see them ("Dokka could not load KotlinBasePlugin").
rootProject {
  buildscript.dependencies.add('classpath', "org.jetbrains.dokka:dokka-gradle-plugin:$dokkaVersion")
}

// Dokka 2 ships no Markdown format. This is the DokkaMarkdownPlugin from the plugin-gfm README, compiled at runtime
// against the root buildscript classloader for the same reason (a class declared here would load Dokka a second time).
def markdownPluginSource = '''
import org.jetbrains.dokka.gradle.formats.DokkaFormatPlugin
abstract class DokkaMarkdownPlugin extends DokkaFormatPlugin {
  DokkaMarkdownPlugin() { super('markdown') }
  void configure(DokkaFormatPlugin.DokkaFormatPluginContext ctx) {
    def deps = ctx.project.dependencies
    ctx.dokkaPlugin(deps, ctx.dokka(deps, 'gfm-plugin'))
    ctx.formatDependencies.dokkaPublicationPluginClasspathApiOnly.dependencies.addLater(
      ctx.dokka(deps, 'gfm-template-processing-plugin'))
  }
}
'''

gradle.beforeProject { p ->
  if (p.path != target) return
  def loader = p.rootProject.buildscript.classLoader
  p.pluginManager.apply(loader.loadClass('org.jetbrains.dokka.gradle.DokkaPlugin'))
  p.pluginManager.apply(new GroovyClassLoader(loader).parseClass(markdownPluginSource))
  // KGP's 'main' and AGP's 'release' both get src/main, which Dokka rejects ("have the common source roots")
  p.extensions.getByName('dokka').dokkaSourceSets.matching { it.name == 'release' }.configureEach { it.suppress.set(true) }
}
```

No visibility settings: Dokka's default `documentedVisibilities` is `PUBLIC`, and dokka-base drops `@suppress` symbols.
Dokka artifacts resolve from `mavenCentral()`, which the Expo template's root `build.gradle` already declares for both
the buildscript and all projects.

## Commands

From a clean clone (`SPIKE` = this folder, `OUT` = the output root). The Gradle project name is the npm package name.

```sh
git clone https://github.com/RasmusKard/react-native-minimal-webview.git mrw && cd mrw
npm ci && (cd example && npm ci)
(cd example && npx expo prebuild --platform android --no-install)
(cd example/android && ./gradlew --init-script "$SPIKE/dokka-gfm.init.gradle" \
  -PdokkaProject=:react-native-minimal-webview :react-native-minimal-webview:dokkaGenerateMarkdown)
rm -rf "$OUT/kotlin" && cp -R android/build/dokka/markdown "$OUT/kotlin"
```

Run here in an APFS copy of `~/minimal-rn-webview` with `example/android` deleted first, which matches a clean clone
for these steps. The first three lines are the repo's CI (`.github/workflows/kotlin.yml`). Dokka writes only to
`android/build/dokka/` (gitignored). The task compiles the module and `expo-modules-core` (release variant) first.

## Output layout

```
kotlin/
  index.md                                   # module page: list of packages
  react-native-minimal-webview/
    package-list                             # Dokka link metadata, no extension; not a page
    expo.modules.minimalwebview/
      index.md                               # package page: table of types
      -minimal-web-view-hooks/index.md, register.md
      -web-view-context/index.md, ask.md, chrome-clients.md, ... (one page per member)
      -document-scope/index.md
      -document-scope/-end/index.md, entries.md, value-of.md, values.md
      -document-scope/-end/-c-l-o-s-i-n-g/index.md (and -c-o-m-m-i-t-t-e-d, -c-r-a-s-h-e-d)
```

- File names: Dokka's lowercase kebab encoding, each capital becomes `-` + lowercase (`WebViewContext` →
  `-web-view-context`, `CLOSING` → `-c-l-o-s-i-n-g`). Types and enum entries are folders with `index.md`; members are
  `<name>.md` beside them. No `:`, `(`, `)`, `!`, `=`, `*`, `?`, `"`, `<`, `>`, `|` in any name, so Windows and
  `actions/upload-artifact` accept the tree as is; longest path here is 164 characters including the absolute prefix.
  Many names start with `-`, harmless for upload but needing `--` or `./` before them in shell commands.
- Links: relative, with `.md` (`../-web-view-context/clients.md`). External types link to developer.android.com and
  kotlinlang.org. Types from `expo-modules-core` (`Module`, `AppContext`) are plain text.
- Each page starts with a breadcrumb line `//[react-native-minimal-webview](../../../index.md)/[...](...)`, then an
  `# H1` with the symbol name. Every signature and table cell is prefixed `[androidJvm]` (the source set's platform).
  Member tables use `<br>` and `&lt;`/`&gt;` inside table cells; declarations are not fenced code blocks.
- Inherited members not documented in this module (enum `name`/`ordinal`, `Module`'s `appContext`, `sendEvent`, ...)
  link to `index.md#<hash>%2FProperties%2F<hash>` anchors that don't exist in the GFM output (dead anchors).

## Coverage check

| Type | Page |
|---|---|
| `MinimalWebViewHooks` | `-minimal-web-view-hooks/index.md` (+ `register`) |
| `WebViewContext` | `-web-view-context/index.md` (+ 13 members) |
| `DocumentScope` | `-document-scope/index.md` (+ nested enum `End`) |
| `MinimalWebViewModule` | **no page**: its KDoc says "Public only for Expo's autolinking." and carries `@suppress` |

- `@suppress` works: the class and all its members are gone, and the package page lists three types. To confirm the
  pipeline would page it otherwise, one run with the `@suppress` line removed (in the scratch copy, reverted at once)
  produced `-minimal-web-view-module/index.md`, `definition.md` and a constructor page.
- What was public only because Expo requires it: `MinimalWebViewModule` (Expo's autolinking needs a public `Module`
  subclass). Without `@suppress` it brings its public constructor, `override fun definition()` and the inherited
  `Module` API (`appContext`, `registry`, `runtime`, deprecated `runtimeContext`, `converters`, four `sendEvent`
  overloads). No other Expo-required symbol is public; `DocumentScope`'s constructor is `internal` and does not appear.
- Also public in the output, by the language rather than Expo: the enum's synthetic `entries`, `values()`, `valueOf()`
  pages and inherited `name`/`ordinal` rows.
- Internal and private symbols: none in the output.

## Problems hit and workarounds

1. Kotlin DSL init script (`initscript { classpath("org.jetbrains.dokka:dokka-gradle-plugin:2.2.0") }` plus the
   README's `DokkaMarkdownPlugin` class) built successfully but generated **0 files**. Log:
   ```
   Dokka Gradle plugin failed to get extension androidComponents com.android.build.api.variant.LibraryAndroidComponentsExtension in :react-native-minimal-webview
   warning: Dokka could not load KotlinBasePlugin in project ':react-native-minimal-webview', even though plugin org.jetbrains.kotlin.android is applied.
   ```
   Cause: the init script classloader can't see the AGP/KGP classes on the example app's root buildscript classpath.
   Fix: add Dokka to the root project's buildscript classpath from the init script, and compile the format plugin
   class at runtime against that classloader (`GroovyClassLoader`), since any class declared in the init script
   itself would bind to a second copy of Dokka.
2. With Dokka loaded correctly, `dokkaGeneratePublicationMarkdown` failed:
   ```
   > Pre-generation validity check failed: Source sets 'androidJvm' and 'release' have the common source roots: .../android/src/main/kotlin, .../android/src/main/java. Every Kotlin source file should belong to only one source set (module).
   ```
   Dokka registers an unsuppressed `main` (shown as `androidJvm`) and `release` source set, both containing
   `src/main` (AGP 9 with `builtInKotlin=false`). Fix: suppress `release`. `main` keeps a full classpath (Android
   and AndroidX types resolve to links).

No fallback needed: GFM applies through the init script, so dokka-mkdocs was not tried.

## For the phase-2 generator

- Inputs it must detect: the example app's Android dir (`example/android`) and the module's Gradle path
  (`:<npm package name>`); output dir is `<package>/android/build/dokka/markdown`.
- Ship the init script as a file and pass its absolute path; the only parameter is `-PdokkaProject`.
- The `release` suppression is tied to this AGP/KGP setup; with a project where Dokka finds only one source set, the
  rule is a no-op, but a different overlap (e.g. `debug`) would need the same treatment. Verify against the next
  Expo SDK.
- If the package's own build already applies `org.jetbrains.dokka`, the init script would add a second Dokka to the
  classpath. Detect it (grep `android/build.gradle`) and fail clearly, or skip the injection.
- `gradle.beforeProject` is not compatible with Gradle isolated projects; fine while Expo apps don't enable them.
- Decide whether to drop `package-list` from the copied tree and whether the `[androidJvm]` prefixes, breadcrumb lines
  and dead inherited-member anchors are acceptable for the site (fixed decisions say no fix-up scripts for DocC; the
  same question applies here).
