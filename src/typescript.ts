import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type { OptionsReader } from 'typedoc';
import type { Generator } from './library.ts';

/** Runs TypeDoc with typedoc-plugin-markdown on the repo's own TypeDoc config. */
export const generateTypeScript: Generator = async (library, out) => {
  // loaded here so the other generators work without TypeDoc installed
  const typedoc = await import('typedoc');
  if (!typedoc.Application.VERSION.startsWith('0.28.')) {
    throw new Error(`TypeDoc ${typedoc.Application.VERSION} (${import.meta.resolve('typedoc')}) is not supported; install typedoc 0.28.x`);
  }

  // Plugins given as local files (resolved to absolute paths) are the repo's own HTML tweaks: drop them, keep packages.
  const optionOverrides: OptionsReader = {
    name: 'rn-cross-platform-docs',
    order: 300, // after the config file and tsconfig readers
    supportsPackages: false,
    read(options, logger) {
      const configuredPlugins = options.getValue('plugin').filter((p) => p !== 'typedoc-plugin-markdown');
      const localPlugins = configuredPlugins.filter((p) => typeof p === 'string' && isAbsolute(p));
      for (const p of localPlugins) logger.info(`Dropping local TypeDoc plugin ${p}`);
      options.setValue('plugin', [...configuredPlugins.filter((p) => !localPlugins.includes(p)), 'typedoc-plugin-markdown']);
      // TypeDoc's own fallback reads package.json exports, which point at unbuilt output in RN library scaffolds
      const defaultEntry = ['src/index.ts', 'src/index.tsx'].find((f) => existsSync(join(library.root, f)));
      if (options.getValue('entryPoints').length === 0 && defaultEntry) options.setValue('entryPoints', [defaultEntry]);
      // output shortcuts (`html`, `json`, `markdown`) would each write another output at the config's path, in the repo
      for (const d of options.getDeclarations()) if ('outputShortcut' in d && d.outputShortcut) options.reset(d.name);
    },
  };

  const cwd = process.cwd();
  process.chdir(library.root); // TypeDoc finds its config and resolves options from the cwd
  try {
    await rm(out, { recursive: true, force: true });
    const app = await typedoc.Application.bootstrapWithPlugins({ out, readme: 'none' }, [
      new typedoc.TypeDocReader(),
      new typedoc.PackageJsonReader(),
      new typedoc.TSConfigReader(),
      optionOverrides,
    ]);
    // fails where TypeDoc's own CLI would; the logger has already printed why
    const throwIfFailed = (ok = true) => {
      const strict = app.options.getValue('treatWarningsAsErrors');
      if (!ok || app.logger.hasErrors() || (strict && app.logger.hasWarnings())) {
        throw new Error(`TypeDoc failed in ${library.root}`);
      }
    };
    throwIfFailed();
    const project = await app.convert();
    if (!project) return throwIfFailed(false);
    throwIfFailed();
    const warningsBeforeValidation = app.logger.warningCount;
    app.validate(project);
    const hasValidationWarnings = app.logger.warningCount !== warningsBeforeValidation || app.logger.validationWarningCount !== 0;
    throwIfFailed(!app.options.getValue('treatValidationWarningsAsErrors') || !hasValidationWarnings);
    await app.generateOutputs(project);
    throwIfFailed();
    // only holds the HTML theme's customCss, which TypeDoc copies for any output
    await rm(join(out, 'assets'), { recursive: true, force: true });
  } finally {
    process.chdir(cwd);
  }
};
