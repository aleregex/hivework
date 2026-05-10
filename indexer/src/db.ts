// Prisma client is generated into api/src/generated/prisma (the schema lives
// there and B1 owns it). We import across packages instead of duplicating the
// client. Run `npm run prisma:generate` after a fresh clone to materialize it.
//
// Prisma 7 with the `prisma-client` generator requires a driver adapter; we
// use @prisma/adapter-pg since the schema's datasource is postgres. The
// api/ side configures Prisma the same way (api/src/plugins/prisma.ts).
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../api/src/generated/prisma/client.js'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL not set')

const adapter = new PrismaPg({ connectionString })
export const prisma = new PrismaClient({ adapter })
