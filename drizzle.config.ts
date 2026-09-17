import { defineConfig } from 'drizzle-kit'
import { serverEnv } from './config/env/server-env'

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: serverEnv.DATABASE_URL,
  },
})
