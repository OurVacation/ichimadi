import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // content/phrases.json은 frontend 밖(레포 루트)에 있다
    fs: { allow: ['..'] },
    // 로컬 백엔드: docker compose up -d db api
    proxy: { '/api': 'http://localhost:8000' },
  },
})
