import type { SystemModelMessage } from "ai"

import { engineInstructions } from "./engine"
import { runtimeInstructions } from "./runtime"
import { workflowInstructions } from "./workflow"

/**
 * Instructions système d'une partie, dans l'ordre où le modèle les lit : le
 * rôle et la méthode de travail, l'environnement d'exécution, puis le kit 3D
 * qu'il doit utiliser (il faut connaître le décor avant ses outils).
 *
 * Un seul message, pas un tableau : le `streamText` géré par `chat.agent`
 * ignore sans erreur un `system` qui n'est ni une string ni un message unique.
 */
export const gameInstructions: SystemModelMessage = {
  role: "system",
  content: [workflowInstructions, runtimeInstructions, engineInstructions]
    .map((message) => message.content)
    .join("\n\n"),
}
