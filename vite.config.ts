import adapter from '@sveltejs/adapter-node';
import adapterVercel from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const runtimeProcess = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process;
const isVercelBuild = runtimeProcess?.env?.VERCEL === '1' || runtimeProcess?.env?.VERCEL === 'true';

export default defineConfig({
  plugins: [
    sveltekit({
      adapter: isVercelBuild ? adapterVercel({ runtime: 'nodejs22.x' }) : adapter(),
    }),
  ],
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm'],
  },
});
