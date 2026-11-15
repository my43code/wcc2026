import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// The app talks to Supabase directly, so no API proxy is needed in development.
export default defineConfig({
  plugins: [react()],
})
