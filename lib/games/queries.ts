import "server-only"

import { auth } from "@clerk/nextjs/server"
import { and, desc, eq, isNull } from "drizzle-orm"

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
 * Renomme une partie de l'organisation active. Sans effet si elle n'existe
 * pas ou appartient à une autre organisation.
 */
export async function renameGame(id: string, title: string): Promise<void> {
  const { orgId } = await auth()

  if (!orgId || !UUID_PATTERN.test(id)) {
    return
  }

  await db
    .update(games)
    .set({ title })
    .where(and(eq(games.id, id), eq(games.orgId, orgId)))
}

/**
 * Supprime une partie de l'organisation active et renvoie la ligne
 * supprimée — son `sandboxId` sert à nettoyer la sandbox Daytona associée —
 * ou `null` si elle n'existe pas ou appartient à une autre organisation.
 */
export async function deleteGame(id: string): Promise<Game | null> {
  const { orgId } = await auth()

  if (!orgId || !UUID_PATTERN.test(id)) {
    return null
  }

  const [game] = await db
    .delete(games)
    .where(and(eq(games.id, id), eq(games.orgId, orgId)))
    .returning()

  return game ?? null
}

/**
 * Enregistre la session Trigger.dev d'une partie qui n'en a pas encore. Sans
 * effet si une session existe déjà : l'écraser effacerait son `lastEventId`,
 * le curseur qui évite de rejouer la réponse déjà affichée.
 */
export async function initGameChatSession({
  id,
  orgId,
  publicAccessToken,
}: {
  id: string
  orgId: string
  publicAccessToken: string
}): Promise<void> {
  await db
    .update(games)
    .set({ chatSession: { publicAccessToken } })
    .where(
      and(eq(games.id, id), eq(games.orgId, orgId), isNull(games.chatSession))
    )
}
