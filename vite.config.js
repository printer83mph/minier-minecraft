import { defineConfig } from 'vite'
import dotenv from 'dotenv'

dotenv.config()

export default defineConfig({
  base: process.env.BASE_URL ?? '/',
})
