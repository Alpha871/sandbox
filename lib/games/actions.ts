"use server"

import { auth } from "@clerk/nextjs/server"
import { refresh } from "next/cache"

import { db } from "@/lib/db"
import { games } from "@/lib/db/schema"

/** Longueur maximale d'un titre dérivé du prompt. */
const TITLE_MAX_LENGTH = 60

/** État rendu par le composer, piloté par `useActionState`. */
export type CreateGameState = {
  status: "idle" | "error" | "success"
  message: string | null
}

function readField(formData: FormData, name: string) {
  const value = formData.get(name)

  return typeof value === "string" ? value.trim() : ""
}

/** Première ligne du prompt, espaces normalisés puis tronquée. */
function toTitle(prompt: string) {
  const line = prompt.split("\n")[0].replace(/\s+/g, " ").trim()

  return line.length > TITLE_MAX_LENGTH
    ? `${line.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`
    : line
}

export async function createGame(
  _previousState: CreateGameState,
  formData: FormData
): Promise<CreateGameState> {
  // Une Server Action est joignable par POST direct : on revérifie la session
  // ici plutôt que de se reposer sur le rendu de la page.
  const { orgId } = await auth()

  if (!orgId) {
    return {
      status: "error",
      message: "Select an organization before creating a game.",
    }
  }

  // Le textarea et les suggestions portent deux noms distincts : un champ
  // unique renverrait le textarea (vide) au clic sur une suggestion.
  const prompt =
    readField(formData, "prompt") || readField(formData, "suggestion")
  const title = toTitle(prompt)

  if (!title) {
    return {
      status: "error",
      message: "Describe the game you want to build first.",
    }
  }

  try {
    await db.insert(games).values({ orgId, title })
  } catch (error) {
    // L'erreur brute (chaîne de connexion, SQL) ne doit pas atteindre le
    // client : on la garde côté serveur et on renvoie un message neutre.
    console.error("[games] createGame a échoué", error)

    return {
      status: "error",
      message: "Couldn't save your game. Check your connection and try again.",
    }
  }

  // Re-rend `app/(app)/layout.tsx` : la sidebar affiche la nouvelle partie.
  refresh()

  return { status: "success", message: null }
}
