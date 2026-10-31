import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.claude', 'dist', 'spike', 'test/fixtures'] },
  js.configs.recommended,
  tseslint.configs.recommended,
);
