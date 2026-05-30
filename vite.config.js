import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

function gitInfo() {
  if (process.env.GIT_SHA && process.env.GIT_SHA !== 'unknown') {
    return { sha: process.env.GIT_SHA.slice(0, 7), log: process.env.GIT_LOG || '' };
  }
  try {
    return {
      sha: execSync('git rev-parse --short HEAD').toString().trim(),
      log: execSync('git log --oneline -10').toString().trim(),
    };
  } catch {
    return { sha: 'unknown', log: '' };
  }
}

const { sha, log } = gitInfo();

export default defineConfig({
  define: {
    __GIT_SHA__: JSON.stringify(sha),
    __GIT_LOG__: JSON.stringify(log),
  },
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
