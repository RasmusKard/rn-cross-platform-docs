import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type { OptionsReader } from 'typedoc';
import type { Generator } from './stack.ts';

/** Runs TypeDoc with typedoc-plugin-markdown on the repo's own TypeDoc config, as spike S1 does. */
export const generateTypeScript: Generator = async (stack, out) => {
  // loaded here so the other generators work without TypeDoc installed
  const td = await import('typedoc');
  if (!td.Application.VERSION.startsWith('0.28.')) {
    throw new Error(`TypeDoc ${td.Application.VERSION} (${import.meta.resolve('typedoc')}) is not supported; install typedoc 0.28.x`);
  }

  // Plugins given as local files (resolved to absolute paths) are the repo's own HTML tweaks: drop them, keep packages.
  const plugins: OptionsReader = {
    name: 'rn-cross-platform-docs',
    order: 300, // after the config file and tsconfig readers
    supportsPackages: false,
    read(options, logger) {
      const repo = options.getValue('plugin').filter((p) => p !== 'typedoc-plugin-markdown');
      const local = repo.filter((p) => typeof p === 'string' && isAbsolute(p));
      for (const p of local) logger.info(`Dropping local TypeDoc plugin ${p}`);
      options.setValue('plugin', [...repo.filter((p) => !local.includes(p)), 'typedoc-plugin-markdown']);
      // TypeDoc's own fallback reads package.json exports, which point at unbuilt output in RN library scaffolds
      const entry = ['src/index.ts', 'src/index.tsx'].find((f) => existsSync(join(stack.root, f)));
      if (options.getValue('entryPoints').length === 0 && entry) options.setValue('entryPoints', [entry]);
    },
  };

  const cwd = process.cwd();
  process.chdir(stack.root); // TypeDoc finds its config and resolves options from the cwd
  try {
    await rm(out, { recursive: true, force: true });
    const app = await td.Application.bootstrapWithPlugins({ out, readme: 'none' }, [
      new td.TypeDocReader(),
      new td.PackageJsonReader(),
      new td.TSConfigReader(),
      plugins,
    ]);
    // fails where TypeDoc's own CLI would; the logger has already printed why
    const check = (ok = true) => {
      const strict = app.options.getValue('treatWarningsAsErrors');
      if (!ok || app.logger.hasErrors() || (strict && app.logger.hasWarnings())) {
        throw new Error(`TypeDoc failed in ${stack.root}`);
      }
    };
    check();
    const project = await app.convert();
    if (!project) return check(false);
    check();
    const warnings = app.logger.warningCount;
    app.validate(project);
    check(!app.options.getValue('treatValidationWarningsAsErrors') || app.logger.warningCount === warnings);
    await app.generateOutputs(project);
    check();
    // only holds the HTML theme's customCss, which TypeDoc copies for any output
    await rm(join(out, 'assets'), { recursive: true, force: true });
  } finally {
    process.chdir(cwd);
  }
};
