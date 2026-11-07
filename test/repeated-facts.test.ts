import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const pkg = JSON.parse(read('package.json')) as {
  peerDependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

/** Whether the exact `version` is in `range`, of the two forms the peer ranges use: `1.2.3` and `1.2.x`. */
function satisfies(version: string, range: string): boolean {
  assert.match(version, /^\d+\.\d+\.\d+$/, `package.json: this test reads only exact devDependencies, not ${version}`);
  assert.match(
    range,
    /^\d+\.\d+\.(\d+|x)$/,
    `package.json: this test reads only peer ranges like 1.2.3 and 1.2.x, not ${range}`,
  );
  const parts = version.split('.');
  return range.split('.').every((part, i) => part === 'x' || part === parts[i]);
}

type Node = { value: string; lines: string[] };

/** The keys of the least indented lines of block-style YAML, each with its inline value and the lines nested under it. */
function mapping(lines: string[]): Map<string, Node> {
  const content = lines.map((l) => l.trimEnd()).filter((l) => l && !l.trimStart().startsWith('#'));
  const indent = Math.min(...content.map((l) => l.search(/\S/)));
  const keys = new Map<string, Node>();
  let node: Node | undefined;
  for (const line of content) {
    if (line.search(/\S/) > indent) {
      node?.lines.push(line);
      continue;
    }
    const m = /^\s*([\w-]+):(?:\s+(.*))?$/.exec(line);
    assert.ok(m, `this test can't read the YAML line ${JSON.stringify(line)}`);
    node = { value: m[2] ?? '', lines: [] };
    keys.set(m[1], node);
  }
  return keys;
}

/** The lines nested under the keys `path` in a workflow file. */
function at(file: string, path: string[]): string[] {
  let lines = read(file).split('\n');
  for (const [i, key] of path.entries()) {
    const node = mapping(lines).get(key);
    assert.ok(node, `${file}: found no ${path.slice(0, i + 1).join('.')}`);
    lines = node.lines;
  }
  return lines;
}

/** A one-line scalar's value, without its quotes or comment. */
function scalar({ value, lines }: Node): string {
  assert.equal(lines.length, 0, `this test reads only one-line YAML values, not ${value}`);
  const single = /^'((?:[^']|'')*)'(?:\s+#.*)?$/.exec(value);
  if (single) return single[1].replaceAll("''", "'");
  const double = /^("(?:[^"\\]|\\.)*")(?:\s+#.*)?$/.exec(value);
  if (double) return JSON.parse(double[1]) as string;
  return value.replace(/\s+#.*$/, '');
}

/** A reusable workflow's inputs, by name. */
function inputs(file: string): Map<string, { type: string; default?: string }> {
  const found = new Map<string, { type: string; default?: string }>();
  for (const [name, node] of mapping(at(file, ['on', 'workflow_call', 'inputs']))) {
    const props = mapping(node.lines);
    const type = props.get('type');
    // workflow_call requires a type, so a missing one means the parse went wrong
    assert.ok(type, `${file}: found no type for input ${name}`);
    const fallback = props.get('default');
    found.set(name, { type: scalar(type), default: fallback && scalar(fallback) });
  }
  assert.ok(found.size > 0, `${file}: found no on.workflow_call.inputs`);
  return found;
}

await test("the README's install command pins each peer dependency at its devDependency version", () => {
  const lines = read('README.md').split('\n');
  const i = lines.findIndex((l) => /^npm install .*@rn-cross-platform-docs\/cli(\s|$)/.test(l));
  assert.ok(i >= 0, 'README.md: found no `npm install ... @rn-cross-platform-docs/cli` command');
  const pins = new Map([...lines[i].matchAll(/\s(@?[^\s@]+)@(\S+)/g)].map((m) => [m[1], m[2]]));
  for (const name of Object.keys(pkg.peerDependencies)) {
    const version = pkg.devDependencies[name];
    assert.equal(
      pins.get(name),
      version,
      `README.md:${i + 1} should install ${name}@${version}, the version package.json's devDependencies test; update its install command`,
    );
  }
});

await test('each devDependency is in its peer range', () => {
  for (const [name, range] of Object.entries(pkg.peerDependencies)) {
    const version = pkg.devDependencies[name];
    assert.ok(version, `package.json: peer dependency ${name} has no devDependency, so no version of it is tested`);
    assert.ok(
      satisfies(version, range),
      `package.json: devDependency ${name}@${version} is outside its peer range ${range}; update peerDependencies.${name} to include the version the repo tests`,
    );
  }
});

await test('each input deploy-zensical.yml passes to generate.yml has the same type and default in both', () => {
  const deployFile = '.github/workflows/deploy-zensical.yml';
  const deploy = inputs(deployFile);
  const generate = inputs('.github/workflows/generate.yml');
  const callers = [...mapping(at(deployFile, ['jobs'])).values()]
    .map((job) => mapping(job.lines))
    .filter((job) => job.get('uses')?.value === './.github/workflows/generate.yml');
  assert.equal(callers.length, 1, `${deployFile}: found ${callers.length} jobs that use generate.yml, not one`);
  const passed = [...mapping(callers[0].get('with')?.lines ?? [])].flatMap(([key, node]) => {
    const name = /^\$\{\{\s*inputs\.([\w-]+)\s*\}\}$/.exec(scalar(node))?.[1];
    return name ? [[name, key]] : [];
  });
  assert.ok(passed.length > 0, `${deployFile}: found no inputs that it passes to generate.yml`);
  for (const [name, key] of passed) {
    const ours = deploy.get(name);
    const theirs = generate.get(key);
    assert.ok(ours, `${deployFile}: passes inputs.${name}, which it doesn't declare`);
    assert.ok(theirs, `${deployFile}: passes ${key}, which generate.yml doesn't declare`);
    assert.deepEqual(
      ours,
      theirs,
      `deploy-zensical.yml passes its input ${name} (actual) to generate.yml's ${key} (expected), so they should have the same type and default; update the one that's behind`,
    );
  }
});
