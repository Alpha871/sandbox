import "server-only"

import { auth } from "@clerk/nextjs/server"
import type { UIMessage } from "ai"
import { and, desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { games, type Game } from "@/lib/db/schema"

/** Nombre de parties remontées dans « Recents ». */
const RECENTS_LIMIT = 30

// Postgres rejette un uuid mal formé : sans ce contrôle, `/games/abc`
// finirait en 500 au lieu d'un 404.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

/**
 * Une partie de l'organisation active, ou `null` si elle n'existe pas ou
 * appartient à une autre organisation — les deux cas sont indiscernables.
 */
export async function getGame(id: string): Promise<Game | null> {
  const { orgId } = await auth()

  if (!orgId || !UUID_PATTERN.test(id)) {
    return null
  }

  // Pas de try/catch, contrairement à `listGames` : la partie est le cœur de
  // la page, une base injoignable doit atteindre l'error boundary plutôt que
  // se déguiser en 404.
  const [game] = await db
    .select()
    .from(games)
    .where(and(eq(games.id, id), eq(games.orgId, orgId)))
    .limit(1)

  return game ?? null
}

/**
 * Remplace le fil complet du chat d'une partie. `orgId` est passé plutôt que
 * lu via `auth()` : l'appel part de `onEnd`, une fois le streaming commencé.
 */
export async function saveGameMessages({
  id,
  orgId,
  messages,
}: {
  id: string
  orgId: string
  messages: UIMessage[]
}): Promise<void> {
  await db
    .update(games)
    .set({ messages })
    .where(and(eq(games.id, id), eq(games.orgId, orgId)))
}
