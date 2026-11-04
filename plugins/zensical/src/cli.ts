#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { build } from './build.ts';

const help = `Usage: rn-cross-platform-docs-zensical build [options]

Builds a Zensical docs site for the React Native library in the current directory from its
README.md (home page), guides/ and the Markdown API reference made by rn-cross-platform-docs.
Needs uv (https://docs.astral.sh/uv/) on PATH; it runs Zensical as this package's uv.lock pins it.

Options:
  --reference <dir>   reference root holding typescript/, kotlin/, swift/ (default: docs/reference)
  --out <dir>         site project, replaced on each run; the built site is <out>/site (default: docs-site)
  --site-url <url>    URL the site is served from (default: none)
  -h, --help          show this help
`;

const { values, positionals } = (() => {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        reference: { type: 'string', default: 'docs/reference' },
        out: { type: 'string', default: 'docs-site' },
        'site-url': { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n\n${help}`);
    process.exit(2);
  }
})();

if (values.help || positionals.length === 0) {
  process.stdout.write(help);
} else if (positionals[0] !== 'build' || positionals.length > 1) {
  process.stderr.write(`Unknown command: ${positionals.join(' ')}\n\n${help}`);
  process.exitCode = 2;
} else {
  await build(process.cwd(), { reference: values.reference, out: values.out, siteUrl: values['site-url'] }).catch(
    (e: Error) => {
      process.stderr.write(`rn-cross-platform-docs-zensical: ${e.message}\n`);
      process.exitCode = 1;
    },
  );
}
