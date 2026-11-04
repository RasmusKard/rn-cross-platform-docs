# Changelog

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
