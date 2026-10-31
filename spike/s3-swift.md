# S3: Swift to Markdown via `xcodebuild docbuild`

Purpose: record the exact commands that turn the iOS pod of an Expo module (`~/minimal-rn-webview`, pod `MinimalWebView`) into DocC Markdown, plus what that Markdown looks like, so a phase-2 generator can script it.

Result: it works without a fallback. `xcodebuild docbuild` accepts the Markdown flags through `OTHER_DOCC_FLAGS`, so `docc convert` on a hand-made symbol graph was not needed. The output is in `out/swift/`.

## Tool versions

- Xcode 27.2 (27B52), iOS Simulator SDK 27.2
- Swift 6.4.2 (swiftlang-6.4.2.1.9); DocC from `XcodeDefault.xctoolchain/usr/bin/docc`
- CocoaPods 1.17.0, Node v26.11.1, Expo SDK 58 (`expo ~58.0.19`), React Native 0.88.0

## Commands

These run from the repo root of a clean clone. In the spike, `node_modules` came from the working tree's APFS clone instead of `npm ci`. Everything below `npm ci` ran exactly as written.

```sh
DD="$PWD/.dd"   # any DerivedData path
npm ci && (cd example && npm ci)
cd example
CI=1 npx expo prebuild --platform ios --no-install
(cd ios && pod install)
cd ios
xcodebuild docbuild \
  -workspace "$(ls -d *.xcworkspace)" \
  -scheme MinimalWebView \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$DD" \
  'OTHER_DOCC_FLAGS=--enable-experimental-markdown-output --enable-experimental-markdown-output-manifest --no-transform-for-static-hosting'

A="$DD/Build/Products/Debug-iphonesimulator/MinimalWebView/MinimalWebView.doccarchive"
OUT=<out>/swift
rsync -a --include='*/' --include='*.md' --exclude='*' --prune-empty-dirs "$A/data/" "$OUT/"
cp "$A/MinimalWebView-markdown-manifest.json" "$OUT/"
```

Notes on the commands:
- The workspace name comes from the app's package name (`reactnativeminimalwebviewexample.xcworkspace`). The repo's existing, git-ignored `example/ios` has an older name (`minimalrnwebviewexample`), so the generator must glob for the workspace and never hard-code it.
- `-scheme MinimalWebView` is the pod's own scheme, which CocoaPods generates. It limits the docs to that target: only one `.doccarchive` is produced, and ExpoModulesCore and React get none. ExpoModulesCore ships precompiled, so the only other target that compiles is `ReactCodegen`.
- Xcode passes `OTHER_DOCC_FLAGS` straight to `docc convert`. The log shows `docc convert --emit-lmdb-index ... --enable-experimental-markdown-output --enable-experimental-markdown-output-manifest --additional-symbol-graph-dir .../MinimalWebView.build/symbol-graph`.
- `--no-transform-for-static-hosting` is optional. It drops the per-page HTML (`documentation/` in the archive), but `index.html`, `css/` and `js/` stay. The Markdown is byte-identical with or without it (checked with `diff -r`).
- `generic/platform=iOS Simulator` builds arm64 and x86_64 symbol graphs (`symbol-graph/swift/{arm64,x86_64}-apple-ios-simulator/`).
- Access level: the archive holds only public symbols. Internal types (`HookContext`, `Hook`) are absent. A probe `public struct` marked `@_documentation(visibility: internal)` was absent from every file in the archive, JSON included.

## Where things land in the archive

- Markdown: `MinimalWebView.doccarchive/data/documentation/**/*.md`, next to each page's `.json`.
- Manifest: `MinimalWebView.doccarchive/MinimalWebView-markdown-manifest.json`, at the archive root.
- Catalog images: `MinimalWebView.doccarchive/images/<bundle-id>/<name>.png`. The bundle ID here is `org.cocoapods.MinimalWebView`. The repo has no `.docc` catalog, so nothing lands there today.

## Output layout (`out/swift/`)

```
MinimalWebView-markdown-manifest.json
documentation/minimalwebview.md                       module page
documentation/minimalwebview/<type>.md                 lowercased type name
documentation/minimalwebview/<type>/<member>.md         lowercased, Swift signature as file name
documentation/minimalwebview/<article>.md               catalog articles (probe only)
```

`documentation/` is kept so that a link to `/documentation/X/Y` maps to `documentation/x/y.md` by lowercasing and adding `.md`. The output has 28 pages, including `minimalwebviewhooks.md`, `webviewcontext.md`, `documentscope.md`, `documentscope/end.md`, `minimalwebviewmodule.md` and their members.

Each page has the same shape:
- An HTML comment of JSON metadata: `identifier`, `role`, `symbol.kind`, `preciseIdentifier`, `availability`, `title`.
- `# Title`, the abstract, an untagged code fence with the declaration.
- `## Overview` or `## Discussion`, and `## Parameters` written as a backticked name followed by a paragraph.

Files have no trailing newline.

The manifest (version 0.1.0) has `title`, `documents` (`identifier`, `title`, `documentType`: `symbol` or `article`) and `relationships`. The relationships hold only `conformsTo` and `inheritsFrom`, pointing at external IDs such as `/documentation/ExpoModulesCore/BaseModule`. They say nothing about which page is a member of which.

## Known gaps

To test what the real API lacks, a probe `ios/Probe.swift` went into the scratch copy only. It has overloads, a deprecated method, `==`, `init!`, a `- Note:` callout and a hidden symbol. A probe `.docc` catalog with an image and a Topics extension was run through `xcrun docc convert` against the build's symbol graph. Neither probe is in `out/swift`.

| Gap | Verdict | Example |
|---|---|---|
| Absolute mixed-case links that 404 | Confirmed. Links look like `/documentation/MinimalWebView/WebViewContext`, but files are lowercase with `.md` | `documentation/minimalwebview/minimalwebviewhooks.md` |
| Image paths beside the page, not the archive root | Confirmed. `![..](images/org.cocoapods.MinimalWebView/probe-image.png)` in `data/documentation/minimalwebview.md`, while the file sits at `<archive>/images/...` | probe `minimalwebview.md`, `minimalwebview/guide.md` |
| Type pages without member lists | Confirmed. No `## Topics` unless curated by hand. A catalog extension file with `## Topics` does produce a list, but that is a change to the repo's docs | `documentation/minimalwebview/webviewcontext.md`, also the module page `minimalwebview.md` |
| Overloads share a title, differ by a hash in the file name | Confirmed. Both pages are titled `run(_:)`. A `-(Int)` link resolves to the hash form | probe `spikeprobe/run(_:)-8uxly.md`, `run(_:)-8upfu.md` |
| Deprecation only in the metadata comment | Confirmed, and worse than expected. The only trace is `"availability": ["*: -"]`. There is no "deprecated" text, and `renamed:` is lost | probe `spikeprobe/oldrun().md` |
| No `swift` tag on declaration fences | Confirmed. The fence is a bare triple backtick | `documentation/minimalwebview/documentscope/end/!=(_:_:).md` |
| `> Note:` left as a blockquote | Confirmed, for `Important` too | `documentation/minimalwebview/minimalwebviewhooks.md` (`> Important:`) |
| File names with `(` `)` `:` `!` `=` | Confirmed: `!=(_:_:).md`, probe `==(_:_:).md`. `init!(flag:)` becomes `init(flag:).md`, so the `!` is dropped there | `documentation/minimalwebview/documentscope/end/!=(_:_:).md` |

## Other findings

- A callout that is the first thing in the discussion gets glued to the heading. The probe produced `## Overview> Note: A note callout.`, which breaks both the heading and the callout.
- ObjC helpers show up as public API: `MRWInvoke(_:_:_:_:_:)`, `MRWCatchException(_:)` and `MRWJsonable(_:)`. The podspec has no `public_header_files` or `private_header_files`, so every `.h` is public. Their header doc comments are dropped (the page shows only the declaration). The fix belongs in the podspec (`private_header_files`), not in the generator.
- Inherited and synthesized members get pages: `minimalwebviewmodule/getdynamictype().md` (from ExpoModulesCore), `documentscope/end/!=(_:_:).md` (Equatable). There are also empty article pages `anyargument-implementations.md` and `equatable-implementations.md`, each only a title.
- Enum cases are titled with their full path, e.g. `DocumentScope.End.closing`, but members are not, e.g. `register(...)`.

## Build time

Measured on this Mac:
- `expo prebuild`: 8 s.
- `pod install`: about 2 min. Expo uses precompiled XCFrameworks for ExpoModulesCore and the other Expo pods.
- Cold `docbuild` with empty DerivedData: 53 s wall.
- Incremental `docbuild` after adding one Swift file and re-running `pod install`: 12 s.

## Problems hit

- None with docbuild itself; the first try with `OTHER_DOCC_FLAGS` worked.
- A new file in `ios/` is only picked up after `pod install` runs again, because CocoaPods fixes the source list at install time.
- In this shell, `swift --version` resolves to a swiftly shim that asks for a missing 5.6.3 toolchain. `xcrun swift` and xcodebuild use Xcode's toolchain and are unaffected. The generator should call through `xcrun` / `xcodebuild` only.

## For the phase-2 generator

- Glob the workspace. Take the scheme from the podspec name (`s.name`). Use a private `-derivedDataPath` so the archive path is known.
- Copy `data/**/*.md`, the manifest, and the archive's `images/` if a catalog exists.
- Member lists are absent, and manifest relationships do not give membership. Membership must come from the identifier path (`/documentation/M/Type/member`) or the page JSON next to each `.md`.
- File names contain `(`, `)`, `:`, `!`, `=`. `:` is invalid on Windows and awkward in URLs, so whatever links or serves them must quote them.
- Expect noise pages: inherited conformances, synthesized operators, `*-Implementations` articles, and ObjC helpers from public headers.
