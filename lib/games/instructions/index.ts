import type { SystemModelMessage } from "ai"

import { runtimeInstructions } from "./runtime"
import { workflowInstructions } from "./workflow"

/**
 * Instructions système d'une partie, dans l'ordre où le modèle les lit.
 *
 * Un seul message, pas un tableau : le `streamText` géré par `chat.agent`
 * ignore sans erreur un `system` qui n'est ni une string ni un message unique.
 */
export const gameInstructions: SystemModelMessage = {
  role: "system",
  content: [workflowInstructions, runtimeInstructions]
    .map((message) => message.content)
    .join("\n\n"),
}
