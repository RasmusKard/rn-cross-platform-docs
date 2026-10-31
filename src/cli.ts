#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { generate } from './generate.ts';
import { allPlatforms, type Platform } from './stack.ts';

const help = `Usage: rn-cross-platform-docs generate [options]

Writes Markdown API reference for the React Native library in the current directory,
one tree per platform: <out>/typescript/, <out>/kotlin/, <out>/swift/.

Options:
  --out <dir>          output root (default: docs/reference)
  --platforms <list>   comma-separated subset of ${allPlatforms.join(',')} (default: all detected)
  -h, --help           show this help
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string', default: 'docs/reference' },
    platforms: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help || positionals.length === 0) {
  process.stdout.write(help);
} else if (positionals[0] !== 'generate' || positionals.length > 1) {
  process.stderr.write(`Unknown command: ${positionals.join(' ')}\n\n${help}`);
  process.exitCode = 2;
} else {
  const platforms = values.platforms?.split(',').map((p) => p.trim()) as Platform[] | undefined;
  const unknown = platforms?.filter((p) => !allPlatforms.includes(p)) ?? [];
  if (unknown.length) {
    process.stderr.write(`Unknown platform: ${unknown.join(', ')}\n\n${help}`);
    process.exitCode = 2;
  } else {
    await generate(process.cwd(), { out: values.out, platforms }).catch((e: Error) => {
      process.stderr.write(`rn-cross-platform-docs: ${e.message}\n`);
      process.exitCode = 1;
    });
  }
}
