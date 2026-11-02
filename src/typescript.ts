import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { Application, PackageJsonReader, TSConfigReader, TypeDocReader, type OptionsReader } from 'typedoc';
import type { Generator } from './library.ts';

/** Runs TypeDoc with typedoc-plugin-markdown on the repo's own TypeDoc config. */
export const generateTypeScript: Generator = async (library, out) => {
  const cwd = process.cwd();
  process.chdir(library.root); // TypeDoc finds its config and resolves options from the cwd
  try {
    const app = await Application.bootstrapWithPlugins({ out, readme: 'none' }, [
      new TypeDocReader(),
      new PackageJsonReader(),
      new TSConfigReader(),
      optionOverrides(library.root),
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
    // only holds the HTML theme's customCss, which TypeDoc copies for any output
    await rm(join(out, 'assets'), { recursive: true, force: true });
  } finally {
    process.chdir(cwd);
  }
};

function optionOverrides(root: string): OptionsReader {
  return {
    name: 'rn-cross-platform-docs',
    order: 300, // after the config file and tsconfig readers
    supportsPackages: false,
    read(options, logger) {
      // plugins given as local files (resolved to absolute paths) are the repo's own HTML tweaks; packages stay
      const isLocalFile = (p: unknown) => typeof p === 'string' && isAbsolute(p);
      const plugins = options.getValue('plugin').filter((p) => p !== 'typedoc-plugin-markdown');
      for (const p of plugins.filter(isLocalFile)) logger.info(`Dropping local TypeDoc plugin ${p}`);
      options.setValue('plugin', [...plugins.filter((p) => !isLocalFile(p)), 'typedoc-plugin-markdown']);

      // TypeDoc's own fallback reads package.json exports, which point at unbuilt output in RN library scaffolds
      const defaultEntry = ['src/index.ts', 'src/index.tsx'].find((f) => existsSync(join(root, f)));
      if (options.getValue('entryPoints').length === 0 && defaultEntry) options.setValue('entryPoints', [defaultEntry]);

      // output shortcuts (`html`, `json`, `markdown`) would each write another output at the config's path, in the repo
      for (const d of options.getDeclarations()) if ('outputShortcut' in d && d.outputShortcut) options.reset(d.name);
    },
  };
}

// fails where TypeDoc's own CLI would; the logger has already printed why
function throwIfLogged(app: Application, failed: () => Error) {
  const strict = app.options.getValue('treatWarningsAsErrors');
  if (app.logger.hasErrors() || (strict && app.logger.hasWarnings())) throw failed();
}
