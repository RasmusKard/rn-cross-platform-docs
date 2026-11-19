# Changelog

## [2.0.2](https://github.com/RasmusKard/rn-cross-platform-docs/compare/v2.0.1...v2.0.2) (2026-11-19)


### Bug Fixes

* Keep the sidebar sections a reader opens open on the site's next pages ([#93](https://github.com/RasmusKard/rn-cross-platform-docs/issues/93)) ([b9ea529](https://github.com/RasmusKard/rn-cross-platform-docs/commit/b9ea52958ddcda5e78ade04c65c5b325c42dafbc))
* Leave the latest GitHub release out of the site's header, which in a monorepo can be another package's ([#92](https://github.com/RasmusKard/rn-cross-platform-docs/issues/92)) ([4a4b390](https://github.com/RasmusKard/rn-cross-platform-docs/commit/4a4b390d4000a30d9f868a8e2efe95c05df72252))
* Widen the site's pages so wide tables and code fit on a wide screen ([#91](https://github.com/RasmusKard/rn-cross-platform-docs/issues/91)) ([dd4ea34](https://github.com/RasmusKard/rn-cross-platform-docs/commit/dd4ea34ea3b87f09be4f0f34bc2033ef3d24e416))

## [2.0.1](https://github.com/RasmusKard/rn-cross-platform-docs/compare/v2.0.0...v2.0.1) (2026-11-19)


### Bug Fixes

* Accept a --reference on another drive than --out ([#89](https://github.com/RasmusKard/rn-cross-platform-docs/issues/89)) ([7db8d44](https://github.com/RasmusKard/rn-cross-platform-docs/commit/7db8d4489354c67d4325a4eb6a0d48e1231d033c))

## [2.0.0](https://github.com/RasmusKard/rn-cross-platform-docs/compare/v1.3.2...v2.0.0) (2026-11-17)


### ⚠ BREAKING CHANGES

* Swift page file names, and so the pages' site URLs, no longer hold `:` or `*`: `greet(_:).md` is now `greet(_-).md` and `*(_:_:).md` is `@(_-_-).md`.

### Bug Fixes

* Keep a guide the README links in its folder, placing the folder in the nav ([#84](https://github.com/RasmusKard/rn-cross-platform-docs/issues/84)) ([4d3a306](https://github.com/RasmusKard/rn-cross-platform-docs/commit/4d3a306abbac4b171eafe5275677806fa9f4ce85))
* Keep the Kotlin root page of a one-package library when it has module documentation ([#79](https://github.com/RasmusKard/rn-cross-platform-docs/issues/79)) ([cf53727](https://github.com/RasmusKard/rn-cross-platform-docs/commit/cf537275d920e8105679c11b8e6aa734cb6f349b))
* Leave TypeDoc's copies of the guides out of search ([#80](https://github.com/RasmusKard/rn-cross-platform-docs/issues/80)) ([3f7c15d](https://github.com/RasmusKard/rn-cross-platform-docs/commit/3f7c15d7953ea82c439460780ab9b429475a7b37))
* Name Swift pages so that Windows can check out a committed tree ([#81](https://github.com/RasmusKard/rn-cross-platform-docs/issues/81)) ([5f8780a](https://github.com/RasmusKard/rn-cross-platform-docs/commit/5f8780a5124dcb6b1bf5e473eeb2aad1d8c850c5))
* Show a deprecation note on the page of a deprecated Swift symbol ([#78](https://github.com/RasmusKard/rn-cross-platform-docs/issues/78)) ([eac0929](https://github.com/RasmusKard/rn-cross-platform-docs/commit/eac09297f57c06e66103754c7e5e3845884967e0))

## [1.3.2](https://github.com/RasmusKard/rn-cross-platform-docs/compare/v1.3.1...v1.3.2) (2026-11-16)


### Bug Fixes

* **deps:** Bump the zensical-dependencies group ([#68](https://github.com/RasmusKard/rn-cross-platform-docs/issues/68)) ([4c195ae](https://github.com/RasmusKard/rn-cross-platform-docs/commit/4c195aeb4d6c893e34124fd095e30887fa9d0a4b))
* **deps:** Bump zensical from 0.0.74 to 0.1.0 in /plugins/zensical ([#70](https://github.com/RasmusKard/rn-cross-platform-docs/issues/70)) ([54146c8](https://github.com/RasmusKard/rn-cross-platform-docs/commit/54146c821e6526a0af26dc2f0a39343ac70487b5))
* **deps:** Bump zensical from 0.1.0 to 0.1.1 in /plugins/zensical ([#75](https://github.com/RasmusKard/rn-cross-platform-docs/issues/75)) ([1e8d492](https://github.com/RasmusKard/rn-cross-platform-docs/commit/1e8d4928dad299c390d2cc07aecd10e535a380ac))

## [1.3.1](https://github.com/RasmusKard/rn-cross-platform-docs/compare/v1.3.0...v1.3.1) (2026-11-16)


### Bug Fixes

* Find a word inside a camelCase name in the site's search ([#71](https://github.com/RasmusKard/rn-cross-platform-docs/issues/71)) ([14ba204](https://github.com/RasmusKard/rn-cross-platform-docs/commit/14ba2046282f833652b2dadbd6ea10b494059073))

## [1.3.0](https://github.com/RasmusKard/rn-cross-platform-docs/compare/v1.2.0...v1.3.0) (2026-11-07)


### Features

* Link the types in Swift declarations to their pages ([#43](https://github.com/RasmusKard/rn-cross-platform-docs/issues/43)) ([726ec6d](https://github.com/RasmusKard/rn-cross-platform-docs/commit/726ec6d0fca821f28139b22c6b56371ff1242acb))


### Bug Fixes

* Generate the other platforms when only Swift's podspec is ambiguous ([#41](https://github.com/RasmusKard/rn-cross-platform-docs/issues/41)) ([7d85276](https://github.com/RasmusKard/rn-cross-platform-docs/commit/7d8527624462300dcf6982165d64bebba2edae39))
* Give Swift pages file names and links the site build can serve ([#42](https://github.com/RasmusKard/rn-cross-platform-docs/issues/42)) ([5d8eb08](https://github.com/RasmusKard/rn-cross-platform-docs/commit/5d8eb08e6676f7fce886f3da6184e2873f8b549d))
* Ignore a stray comma in --platforms, and name the platforms when the list is empty ([#44](https://github.com/RasmusKard/rn-cross-platform-docs/issues/44)) ([54f6cdb](https://github.com/RasmusKard/rn-cross-platform-docs/commit/54f6cdb09a74da9b9776678ff47a375b963870f0))
* Keep a Kotlin function named like a type from breaking the site build ([#49](https://github.com/RasmusKard/rn-cross-platform-docs/issues/49)) ([7de7cc1](https://github.com/RasmusKard/rn-cross-platform-docs/commit/7de7cc14460e10677261a45905c271383a4dd490))
* Keep the README's images and links to other repo files working on the Zensical site ([#50](https://github.com/RasmusKard/rn-cross-platform-docs/issues/50)) ([ac93d68](https://github.com/RasmusKard/rn-cross-platform-docs/commit/ac93d68f394f17a1524ed8619c676fc0b1907946))
* Keep words apart in Kotlin search results, and list each member once ([#47](https://github.com/RasmusKard/rn-cross-platform-docs/issues/47)) ([ee92d65](https://github.com/RasmusKard/rn-cross-platform-docs/commit/ee92d65477f066a9a356ae0f5b737af54bde7160))
* List each TypeScript member once in search, with its parameters, return value and examples ([#53](https://github.com/RasmusKard/rn-cross-platform-docs/issues/53)) ([9b16f02](https://github.com/RasmusKard/rn-cross-platform-docs/commit/9b16f0277251252b577bcda0e0dbe399955dd5ac))
* Name the missing tool, and what to do, when xcodebuild or gradlew can't run ([#34](https://github.com/RasmusKard/rn-cross-platform-docs/issues/34)) ([1b46c04](https://github.com/RasmusKard/rn-cross-platform-docs/commit/1b46c0463e80590924eb2b9ee5ab7d36a3b25af6))
* Number repeated TypeScript anchors the way typedoc-plugin-markdown does ([#55](https://github.com/RasmusKard/rn-cross-platform-docs/issues/55)) ([caecb86](https://github.com/RasmusKard/rn-cross-platform-docs/commit/caecb86230ea6a6f836f783db7f2becc09e1d4ee))
* Order the guides by every kind of README link to them ([#51](https://github.com/RasmusKard/rn-cross-platform-docs/issues/51)) ([cbf63d3](https://github.com/RasmusKard/rn-cross-platform-docs/commit/cbf63d344c81bd1c0b997e814227cdb4599c87cd))
* Point README links into the API reference at the site's pages ([#52](https://github.com/RasmusKard/rn-cross-platform-docs/issues/52)) ([ddd065b](https://github.com/RasmusKard/rn-cross-platform-docs/commit/ddd065babdeb266217e3569f02e961e8a434755b))
* Remove the staging and Swift build directories when generate is interrupted ([#45](https://github.com/RasmusKard/rn-cross-platform-docs/issues/45)) ([41c1f29](https://github.com/RasmusKard/rn-cross-platform-docs/commit/41c1f2957e759cef735b5237ce2cf2726f7fedec))
* Run Zensical from a hash-checked uv.lock that Dependabot keeps up to date ([#56](https://github.com/RasmusKard/rn-cross-platform-docs/issues/56)) ([66aa95f](https://github.com/RasmusKard/rn-cross-platform-docs/commit/66aa95f597216b1239d5b8cfb1f5736e40cf8fc3))
* Show Kotlin signatures as code, without a link to their own page ([#48](https://github.com/RasmusKard/rn-cross-platform-docs/issues/48)) ([e76fe52](https://github.com/RasmusKard/rn-cross-platform-docs/commit/e76fe5292ac6eb26fbb4680b2458a5654a9ebecf))
* Tell code apart from headings in every kind of code fence ([#54](https://github.com/RasmusKard/rn-cross-platform-docs/issues/54)) ([e3a8b7f](https://github.com/RasmusKard/rn-cross-platform-docs/commit/e3a8b7f4e4d3bb66b0e58011cfde53edec0944c5))
* Title the Kotlin constructors page as constructor, not after its class ([#46](https://github.com/RasmusKard/rn-cross-platform-docs/issues/46)) ([2962678](https://github.com/RasmusKard/rn-cross-platform-docs/commit/2962678127f239e1392321f478f1e6c65b8b0de2))


### Performance Improvements

* Load TypeDoc only when generating the TypeScript reference ([#35](https://github.com/RasmusKard/rn-cross-platform-docs/issues/35)) ([fbe156b](https://github.com/RasmusKard/rn-cross-platform-docs/commit/fbe156b328ec4bd237160640dc56a3c21165cc5b))

## [1.2.0](https://github.com/RasmusKard/rn-cross-platform-docs/compare/v1.1.0...v1.2.0) (2026-11-04)


### Features

* Use the library's Module.md and DocC catalog for the Kotlin and Swift landing pages ([#31](https://github.com/RasmusKard/rn-cross-platform-docs/issues/31)) ([855782e](https://github.com/RasmusKard/rn-cross-platform-docs/commit/855782e9704c67ebd13532be0195fbe726744a09))


### Bug Fixes

* Give Kotlin enum Entries tables a header, without the repeated entry name ([#30](https://github.com/RasmusKard/rn-cross-platform-docs/issues/30)) ([3d457df](https://github.com/RasmusKard/rn-cross-platform-docs/commit/3d457df1bf2fb666cec2bd4d3ff8d6bf40e8c734))
* Keep code in table cells from breaking mid-identifier; a wide table scrolls ([#27](https://github.com/RasmusKard/rn-cross-platform-docs/issues/27)) ([eb30a17](https://github.com/RasmusKard/rn-cross-platform-docs/commit/eb30a1744be5dca45ce47b64a1a01ddcfce6301b))
* Turn TypeDoc's Parameters and Returns headings into labels, so search lists each member once ([#29](https://github.com/RasmusKard/rn-cross-platform-docs/issues/29)) ([ea85512](https://github.com/RasmusKard/rn-cross-platform-docs/commit/ea85512d7c215e85b6cd3346d4832778d208a528))
* Wrap a sidebar label that is one long identifier, instead of cutting it off ([#28](https://github.com/RasmusKard/rn-cross-platform-docs/issues/28)) ([83932c0](https://github.com/RasmusKard/rn-cross-platform-docs/commit/83932c0ace17a3d4568df0f0d60778b687edbedb))

## [1.1.0](https://github.com/RasmusKard/rn-cross-platform-docs/compare/v1.0.0...v1.1.0) (2026-11-03)


### Features

* Build the TypeScript nav from TypeDoc's navigation JSON ([#18](https://github.com/RasmusKard/rn-cross-platform-docs/issues/18)) ([2bac786](https://github.com/RasmusKard/rn-cross-platform-docs/commit/2bac786a1a3e5b7a2921cf31fc550733348b6790))


### Bug Fixes

* Drop Dokka's androidJvm marks and empty table header rows from the site ([#22](https://github.com/RasmusKard/rn-cross-platform-docs/issues/22)) ([d920e71](https://github.com/RasmusKard/rn-cross-platform-docs/commit/d920e713469a50bed6932d28fefbb9c29c8778ef))
* Leave inherited members out of the Kotlin reference ([#21](https://github.com/RasmusKard/rn-cross-platform-docs/issues/21)) ([5513428](https://github.com/RasmusKard/rn-cross-platform-docs/commit/551342844cd9520003f1f6b0cef3453407a6350c))
* Leave out the Kotlin root page that the nav replaces with its one package ([#20](https://github.com/RasmusKard/rn-cross-platform-docs/issues/20)) ([175a46f](https://github.com/RasmusKard/rn-cross-platform-docs/commit/175a46fa151a54c2915a88f0ce8a39b428e8eb87))
* List a Kotlin enum's entries in declaration order, without Dokka's synthetic members ([#23](https://github.com/RasmusKard/rn-cross-platform-docs/issues/23)) ([8763510](https://github.com/RasmusKard/rn-cross-platform-docs/commit/87635106f97ca93b5a80a8d35d74ad849a6aeebe))
* List the rest of the guides only when the README leaves some out ([#19](https://github.com/RasmusKard/rn-cross-platform-docs/issues/19)) ([1b92903](https://github.com/RasmusKard/rn-cross-platform-docs/commit/1b929036bbd5e1cd2ca0f8614d7f80d0ebd5d584))

## 1.0.0 (2026-11-03)


### Features

* Add a reusable workflow that generates the reference ([b87f590](https://github.com/RasmusKard/rn-cross-platform-docs/commit/b87f59047bf88b4ea47c03d146a5a2d2807ae10f))
* Add a working-directory input to the reusable workflows ([e49fe1d](https://github.com/RasmusKard/rn-cross-platform-docs/commit/e49fe1d7d7dc7b31fbfa01879fa02e44691def3b))
* Add the CLI package skeleton with generate and detect commands ([1e76282](https://github.com/RasmusKard/rn-cross-platform-docs/commit/1e76282024bbdb03488706d10227e24f825a255a))
* Add the expo-greeter example module ([0bc4462](https://github.com/RasmusKard/rn-cross-platform-docs/commit/0bc446268bc277794c82945500f240b9e1167cee))
* Add the Kotlin generator ([f9d7c62](https://github.com/RasmusKard/rn-cross-platform-docs/commit/f9d7c627539612ab7b2006b468f0fcd21e4d3185))
* Add the Swift generator ([5b44aee](https://github.com/RasmusKard/rn-cross-platform-docs/commit/5b44aee9b6fbc44d357900040e11e89addbcfeca))
* Add the TypeScript generator ([3388b0c](https://github.com/RasmusKard/rn-cross-platform-docs/commit/3388b0cd3311c296e7d00c0f54c295928e4f0490))
* Add the Zensical site plugin ([61cfc81](https://github.com/RasmusKard/rn-cross-platform-docs/commit/61cfc81c072b98cc1a0349268dce487614129d36))
* Detect the library's stack ([f3a8f78](https://github.com/RasmusKard/rn-cross-platform-docs/commit/f3a8f78bba5c3a2b35f6acebb59350752851bd3a))
* Generate from the library's native projects and add a prepare input to the workflows ([f221e8b](https://github.com/RasmusKard/rn-cross-platform-docs/commit/f221e8bb21237ce618405683c9a26017b9b2b80f))
* Respect the repo's TypeDoc config ([b38a65b](https://github.com/RasmusKard/rn-cross-platform-docs/commit/b38a65b10222b11ae331fef6c8bee34cd2271871))
* Run React Native codegen before Dokka on Turbo modules ([#3](https://github.com/RasmusKard/rn-cross-platform-docs/issues/3)) ([6e416ae](https://github.com/RasmusKard/rn-cross-platform-docs/commit/6e416aeb423a0bfe3aacc335df31e71795321577))


### Performance Improvements

* Cache npm, Gradle and uv downloads in the reusable workflows ([#7](https://github.com/RasmusKard/rn-cross-platform-docs/issues/7)) ([86bcf63](https://github.com/RasmusKard/rn-cross-platform-docs/commit/86bcf63b167c412b7619529b97073ab9e92fe4d8))
