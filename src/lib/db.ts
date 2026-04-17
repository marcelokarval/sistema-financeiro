import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Always create a fresh client in development to pick up schema changes
const db = process.env.NODE_ENV === 'production'
  ? (globalForPrisma.prisma ??= new PrismaClient())
  : new PrismaClient()

export { db }
