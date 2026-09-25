import { google } from "@ai-sdk/google"
import { openai } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"

import type { GameModelId } from "./model-catalog"

/**
 * Les instances de fournisseur derrière chaque id du catalogue
 * (`model-catalog.ts`, client-safe). Les identifiants vendeur réels — qui
 * changent bien plus vite que le catalogue affiché au joueur — vivent
 * seulement ici. Server-only : ce fichier importe les SDK OpenAI et Google et
 * ne doit donc jamais être importé depuis un composant client.
 */
const GAME_MODELS: Record<GameModelId, LanguageModel> = {
  "gemini-flash": google("gemini-3.8-flash"),
  "gemini-pro": google("gemini-3.1-pro-preview"),
  "gpt-5": openai("gpt-5.5"),
}

/** Le modèle de l'agent qui construit le jeu, choisi par le joueur. */
export function getGameModel(id: GameModelId): LanguageModel {
  return GAME_MODELS[id]
}

/** Le modèle qui écrit le titre d'une partie : court, rapide, peu cher — le même pour tout le monde, indépendant du modèle choisi pour la partie. */
export function getTitleModel(): LanguageModel {
  return google("gemini-3.5-flash-lite")
}
