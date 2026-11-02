import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Application, PackageJsonReader, TSConfigReader, TypeDocReader, type OptionsReader } from 'typedoc';
import type { Generator } from './library.ts';

/** Runs TypeDoc on the repo's own config, with typedoc-plugin-markdown added and the output at `out`. */
export const generateTypeScript: Generator = async (library, out) => {
  const cwd = process.cwd();
  process.chdir(library.root); // TypeDoc finds its config and resolves options from the cwd
  try {
    const app = await Application.bootstrapWithPlugins({ out }, [
      new TypeDocReader(),
      new PackageJsonReader(),
      new TSConfigReader(),
      markdownDefaults(library.root),
    ]);
    const failed = () => new Error(`TypeDoc failed in ${library.root}`);
    throwIfLogged(app, failed);
    const project = await app.convert();
    if (!project) throw failed();
    throwIfLogged(app, failed);
    const warningsBefore = app.logger.warningCount;
    app.validate(project);
    const newWarnings = app.logger.warningCount !== warningsBefore || app.logger.validationWarningCount !== 0;
    if (newWarnings && app.options.getValue('treatValidationWarningsAsErrors')) throw failed();
    throwIfLogged(app, failed);
    await app.generateOutputs(project);
    throwIfLogged(app, failed);
  } finally {
    process.chdir(cwd);
  }
};

// runs after the repo's config, so everything but the Markdown plugin applies only where the config is silent
function markdownDefaults(root: string): OptionsReader {
  return {
    name: 'rn-cross-platform-docs',
    order: 300, // after the config file and tsconfig readers
    supportsPackages: false,
    read(options) {
      const plugins = options.getValue('plugin');
      if (!plugins.some((p) => p === 'typedoc-plugin-markdown'))
        options.setValue('plugin', [...plugins, 'typedoc-plugin-markdown']);

      if (!options.isSet('readme')) options.setValue('readme', 'none');

      // TypeDoc's own fallback reads package.json exports, which point at unbuilt output in RN library scaffolds
      const defaultEntry = ['src/index.ts', 'src/index.tsx'].find((f) => existsSync(join(root, f)));
      if (!options.isSet('entryPoints') && defaultEntry) options.setValue('entryPoints', [defaultEntry]);
    },
  };
}

// fails where TypeDoc's own CLI would; the logger has already printed why
function throwIfLogged(app: Application, failed: () => Error) {
  const strict = app.options.getValue('treatWarningsAsErrors');
  if (app.logger.hasErrors() || (strict && app.logger.hasWarnings())) throw failed();
}
