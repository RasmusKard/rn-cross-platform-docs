#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { detectLibrary } from './detect.ts';
import { generate } from './generate.ts';
import { allPlatforms, type Platform } from './library.ts';

const help = `Usage: rn-cross-platform-docs generate [options]
       rn-cross-platform-docs detect

generate writes Markdown API reference for the React Native library in the current directory,
one tree per platform: <out>/typescript/, <out>/kotlin/, <out>/swift/.
detect prints the platforms it would generate by default, one per line.

Options:
  --out <dir>          output root (default: docs/reference)
  --platforms <list>   comma-separated subset of ${allPlatforms.join(',')} (default: all detected)
  -h, --help           show this help
`;

const fail = (e: Error) => {
  process.stderr.write(`rn-cross-platform-docs: ${e.message}\n`);
  process.exitCode = 1;
};
const usageError = (message: string) => {
  process.stderr.write(`${message}\n\n${help}`);
  process.exitCode = 2;
};

let args;
try {
  args = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string', default: 'docs/reference' },
      platforms: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
} catch (e) {
  // an unknown option or a missing option value
  usageError((e as Error).message);
  process.exit(2);
}

if (args.values.help || args.positionals.length === 0) {
  process.stdout.write(help);
} else if (!['generate', 'detect'].includes(args.positionals[0]) || args.positionals.length > 1) {
  usageError(`Unknown command: ${args.positionals.join(' ')}`);
} else if (args.positionals[0] === 'detect') {
  const library = await detectLibrary(process.cwd()).catch(fail);
  if (library) process.stdout.write(`${library.platforms.join('\n')}\n`);
} else {
  const platforms = args.values.platforms?.split(',').map((p) => p.trim()) as Platform[] | undefined;
  const unknown = platforms?.filter((p) => !allPlatforms.includes(p)) ?? [];
  if (unknown.length) usageError(`Unknown platform: ${unknown.join(', ')}`);
  else await generate(process.cwd(), { out: args.values.out, platforms }).catch(fail);
}
