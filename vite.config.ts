import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  // Share content-addressed JS/CSS across deployments so an existing Vercel
  // deployment cookie cannot send fresh asset URLs to an older build.
  return { resolve: { tsconfigPaths: true }, plugins: [tanstackStart(), nitro({ vercel: { immutableStaticFiles: true } }), viteReact()] }
})
