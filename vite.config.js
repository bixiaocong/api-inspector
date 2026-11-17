import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * 说明：
 * - 只有侧边栏 UI（React）走 Vite 构建；
 * - 扩展的 background / content / injected 脚本是纯 JS，
 *   直接放在 public/ 里原样拷贝到 dist/，避免打包干扰。
 * - base: './' 让资源用相对路径，chrome-extension:// 页面才能正常加载。
 */
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    // 入口是 sidepanel.html 而不是 index.html，dev 模式直接打开正确页面
    open: '/sidepanel.html',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(process.cwd(), 'sidepanel.html'),
      },
    },
  },
});
