import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

// Le worker Trigger.dev n'est pas Next : ni `server-only`, ni Clerk, ni
// `lib/db`. Client créé une fois par process, un run n'exécute ses requêtes
// qu'en séquence (voir la doc « Database connections »). Partagé par tous
// les modules du worker (chat-store, credits) pour n'ouvrir qu'une seule
// connexion par process.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5_000,
})

// Une connexion inactive peut échouer en asynchrone : sans handler,
// l'événement `error` fait tomber le worker.
pool.on("error", (error) => console.error("[trigger] pool error", error))

export const db = drizzle(pool)
