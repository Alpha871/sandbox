import "server-only"

import { parseEnv } from "@neon/env"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import neonConfig from "@/neon"

import * as schema from "./schema"

// Pooled connection — l'application passe par PgBouncer ; seules les
// migrations utilisent la connexion directe (voir drizzle.config.ts).
const { postgres } = parseEnv(neonConfig, ["DATABASE_URL"])

// Le HMR de Next recharge ce module à chaque édition : sans ce cache global on
// accumulerait un pool de connexions par rechargement.
const globalForDb = globalThis as unknown as { pool?: Pool }

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: postgres.databaseUrl,
    // Par défaut `pg` s'en remet au timeout TCP du système (~75 s, multiplié
    // par le nombre d'IP résolues pour l'hôte). Une base injoignable doit
    // échouer vite plutôt que retenir le rendu d'une page.
    connectionTimeoutMillis: 5_000,
  })

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool
}

export const db = drizzle(pool, { schema })
