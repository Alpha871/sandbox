import type { SystemModelMessage } from "ai"

import { runtimeInstructions } from "./runtime"
import { workflowInstructions } from "./workflow"

/** Instructions système d'une partie, dans l'ordre où le modèle les lit. */
export const gameInstructions: SystemModelMessage[] = [
  workflowInstructions,
  runtimeInstructions,
]
