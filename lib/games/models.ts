import { google } from "@ai-sdk/google"
import { openai } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"

/**
 * Le modèle de langage d'une partie, choisi par la configuration. Un seul
 * endroit décide, pour que l'agent (`trigger/chat.ts`) et le titre
 * (`lib/games/actions.ts`) restent sur le même fournisseur.
 *
 * Configuration (variables d'environnement) :
 *
 * - `GAME_MODEL_PROVIDER` : `google` (défaut) ou `openai`.
 * - avec `openai` : `OPENAI_API_KEY` (lue par le SDK), `OPENAI_MODEL` (agent,
 *   obligatoire) et `OPENAI_TITLE_MODEL` (titre, retombe sur `OPENAI_MODEL`).
 *   `OPENAI_BASE_URL` est aussi lue par le SDK, pour un proxy.
 *
 * Les identifiants OpenAI ne sont volontairement pas dans le code : les modèles
 * changent vite, et un identifiant périmé ferait échouer chaque partie.
 *
 * Attention : l'agent tourne dans Trigger.dev, qui a son propre jeu de variables
 * d'environnement. Elles doivent y être définies aussi, pas seulement dans
 * `.env.local` (qui ne sert qu'au titre, calculé côté Next.js).
 */

const PROVIDERS = ["google", "openai"] as const

type Provider = (typeof PROVIDERS)[number]

/** Identifiants Google, ceux que le code utilisait avant le choix de fournisseur. */
const GOOGLE_GAME_MODEL = "gemini-3.8-flash"
const GOOGLE_TITLE_MODEL = "gemini-3.5-flash-lite"

function readProvider(): Provider {
  const value = (process.env.GAME_MODEL_PROVIDER ?? "").trim().toLowerCase()

  // Non défini ou vide : comportement d'origine, sans rien configurer.
  if (value === "") return "google"

  if (!PROVIDERS.includes(value as Provider)) {
    throw new Error(
      `GAME_MODEL_PROVIDER="${value}" is not supported. Use one of: ${PROVIDERS.join(", ")}.`
    )
  }

  return value as Provider
}

function readEnv(name: string) {
  return process.env[name]?.trim() || undefined
}

/** Un identifiant obligatoire : l'erreur nomme la variable qui manque. */
function requireEnv(name: string) {
  const value = readEnv(name)

  if (!value) {
    throw new Error(
      `${name} is not set. It is required when GAME_MODEL_PROVIDER=openai.`
    )
  }

  return value
}

/** Le modèle de l'agent qui construit le jeu (outils, contexte long). */
export function getGameModel(): LanguageModel {
  switch (readProvider()) {
    case "openai":
      return openai(requireEnv("OPENAI_MODEL"))
    case "google":
      return google(GOOGLE_GAME_MODEL)
  }
}

/** Le modèle qui écrit le titre d'une partie : court, rapide, peu cher. */
export function getTitleModel(): LanguageModel {
  switch (readProvider()) {
    case "openai":
      return openai(readEnv("OPENAI_TITLE_MODEL") ?? requireEnv("OPENAI_MODEL"))
    case "google":
      return google(GOOGLE_TITLE_MODEL)
  }
}
