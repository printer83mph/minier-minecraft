import dotenv from 'dotenv';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

dotenv.config();

export default defineConfig({
  base: process.env.BASE_URL ?? '/',
  plugins: [tsconfigPaths()],
});
