import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.claude', 'dist', 'examples', 'plugins', 'test/fixtures'] },
  js.configs.recommended,
  tseslint.configs.recommended,
);
