import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const solanaRpcUrl = env.SOLANA_RPC_URL || 'https://solana-rpc.publicnode.com'

  return {
    plugins: [react(), cloudflare()],
    server: {
      proxy: {
        '/api/solana-rpc': {
          target: solanaRpcUrl,
          changeOrigin: true,
          secure: true,
          rewrite: () => '/',
        },
      },
    },
  };
})