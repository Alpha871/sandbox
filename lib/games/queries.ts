import "server-only"

import { auth } from "@clerk/nextjs/server"
import { desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { games, type Game } from "@/lib/db/schema"

/** Nombre de parties remontées dans « Recents ». */
const RECENTS_LIMIT = 30

/**
 * Parties de l'organisation active, la plus récemment modifiée en tête.
 * Hors organisation Clerk ne fournit pas d'`orgId` : la liste est vide.
 */
export async function listGames(): Promise<Game[]> {
  const { orgId } = await auth()

  if (!orgId) {
    return []
  }

  try {
    // Servi par l'index `games_org_updated_idx`.
    return await db
      .select()
      .from(games)
      .where(eq(games.orgId, orgId))
      .orderBy(desc(games.updatedAt))
      .limit(RECENTS_LIMIT)
  } catch (error) {
    // « Recents » est un confort, pas le cœur de la page : une base
    // injoignable ne doit pas faire tomber tout le layout. L'erreur est
    // avalée côté rendu, jamais côté écriture (voir `createGame`).
    console.error("[games] listGames a échoué", error)

    return []
  }
}
