"use server"

import { auth } from "@clerk/nextjs/server"
import { generateId, generateText } from "ai"
import { refresh } from "next/cache"
import { redirect } from "next/navigation"

import { db } from "@/lib/db"
import { games } from "@/lib/db/schema"
import { getTitleModel } from "@/lib/games/models"

/** Longueur maximale d'un titre dérivé du prompt. */
const TITLE_MAX_LENGTH = 60

/** Portion du prompt envoyée au modèle : le début suffit pour un titre. */
const TITLE_PROMPT_MAX_LENGTH = 1000

/**
 * État rendu par le composer, piloté par `useActionState`. Pas d'état
 * « success » : une création réussie redirige vers la partie.
 */
export type CreateGameState = {
  status: "idle" | "error"
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

/** Titre court généré par un modèle rapide, repli sur `toTitle(prompt)`. */
async function generateTitle(prompt: string) {
  try {
    const { text } = await generateText({
      model: getTitleModel(),
      instructions:
        "Write a short title (max 6 words) for the game described by the user. " +
        "Reply with the title only, no quotes, no punctuation at the end.",
      prompt: prompt.slice(0, TITLE_PROMPT_MAX_LENGTH),
      timeout: 5000,
    })

    return toTitle(text.replace(/^["'«\s]+|["'»\s]+$/g, "")) || toTitle(prompt)
  } catch (error) {
    // Le titre est un confort : un modèle indisponible ne doit pas bloquer la
    // création, on retombe sur la première ligne du prompt.
    console.error("[games] generateTitle a échoué", error)

    return toTitle(prompt)
  }
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

  // Vérifié avant l'appel au modèle : un prompt vide ne coûte rien.
  if (!toTitle(prompt)) {
    return {
      status: "error",
      message: "Describe the game you want to build first.",
    }
  }

  const title = await generateTitle(prompt)

  let gameId: string

  try {
    // Le prompt devient le premier message du fil : `ChatThread` demande la
    // réponse à l'ouverture de la partie.
    const [game] = await db
      .insert(games)
      .values({
        orgId,
        title,
        messages: [
          {
            id: generateId(),
            role: "user",
            parts: [{ type: "text", text: prompt }],
          },
        ],
      })
      .returning({ id: games.id })

    gameId = game.id
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

  // Hors du try : `redirect` lève une exception gérée par Next.
  redirect(`/games/${gameId}`)
}
