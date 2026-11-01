# expo-greeter

A minimal Expo module, made with `create-expo-module`, that shows what
[rn-cross-platform-docs](https://github.com/RasmusKard/rn-cross-platform-docs) generates. It has one constant, one
function, one async function and one event, documented in TypeScript, Kotlin and Swift. The native `Module` classes
are hidden from the reference, as the main README
[recommends](https://github.com/RasmusKard/rn-cross-platform-docs#hide-what-is-public-only-for-the-framework).

## Usage

```tsx
import ExpoGreeter from 'expo-greeter';
import { useEvent } from 'expo';
import { Button, Text } from 'react-native';

export function Greeting() {
  const change = useEvent(ExpoGreeter, 'onChange');
  return (
    <>
      <Text>{ExpoGreeter.hello({ name: 'Ada', excited: true })}</Text>
      <Button title="Set value" onPress={() => ExpoGreeter.setValueAsync('Hi!')} />
      <Text>{change?.value}</Text>
    </>
  );
}
```

Native code calls the same logic directly, with `Greeter.greet(GreetingOptions())` in both Kotlin and Swift.

## Build the example site

Needs the toolchains listed in the [main README](https://github.com/RasmusKard/rn-cross-platform-docs#install) and
[uv](https://docs.astral.sh/uv/getting-started/installation/). From the repo root:

```sh
npm ci
(cd plugins/zensical && npm ci)
cd examples/expo-greeter
npm ci
(cd example && npm ci)
npm run docs
```

`npm run docs` writes the reference to `docs/reference/` and the site to `docs-site/site/`; serve the latter over
HTTP, e.g. `uv run --no-project python -m http.server -d docs-site/site`.
