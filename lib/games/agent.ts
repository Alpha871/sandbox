import type { LanguageModel } from "ai"

import { getGameModel } from "./models"
import type { GameModelId } from "./model-catalog"

/**
 * Traduit un id du catalogue (`model-catalog.ts`) en réglages `streamText`
 * pour l'agent qui construit le jeu (`trigger/chat.ts`). Aujourd'hui c'est
 * seulement le modèle, mais un id donné pourrait aussi vouloir des
 * `providerOptions` (budget de réflexion, etc.) — ce fichier reste le seul
 * endroit qui le déciderait.
 */
export function gameStreamTextSettings(id: GameModelId): {
  model: LanguageModel
} {
  return { model: getGameModel(id) }
}
