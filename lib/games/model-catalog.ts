/**
 * Le catalogue des modèles que le joueur peut choisir pour l'agent qui
 * construit sa partie (`trigger/chat.ts`). Client-safe : pas d'import de SDK
 * fournisseur ici, seulement des identifiants et du texte à afficher — ce
 * fichier peut être importé par un composant client (un futur sélecteur de
 * modèle) sans embarquer les clients OpenAI/Google.
 *
 * Les instances de fournisseur (avec les vrais identifiants vendeur) vivent
 * dans `models.ts`, server-only.
 */

export type GameModelId = "gemini-flash" | "gemini-pro" | "gpt-5"

export type GameModelInfo = {
  id: GameModelId
  name: string
  tagline: string
}

export const GAME_MODELS: readonly GameModelInfo[] = [
  {
    id: "gemini-flash",
    name: "Gemini Flash",
    tagline: "Rapide — le choix par défaut.",
  },
  {
    id: "gemini-pro",
    name: "Gemini Pro",
    tagline: "Plus capable, un peu plus lent.",
  },
  {
    id: "gpt-5",
    name: "GPT-5.5",
    tagline: "L'alternative OpenAI.",
  },
]

/** Pour construire un schéma `z.enum(...)` sans dupliquer la liste des ids. */
export const GAME_MODEL_IDS = GAME_MODELS.map((model) => model.id) as [
  GameModelId,
  ...GameModelId[],
]

export const DEFAULT_GAME_MODEL_ID: GameModelId = "gemini-flash"

export function isGameModelId(value: string): value is GameModelId {
  return GAME_MODEL_IDS.includes(value as GameModelId)
}
