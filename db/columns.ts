import { timestamp } from 'drizzle-orm/pg-core'

export const dateTime = (name: string) => timestamp(name, { mode: 'date', precision: 3 })
