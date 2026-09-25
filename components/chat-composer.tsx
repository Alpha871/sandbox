"use client"

import {
  ArrowUpIcon,
  ChevronDownIcon,
  GripIcon,
  SquareIcon,
} from "lucide-react"
import type { FormEvent, KeyboardEvent } from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { GAME_MODELS, type GameModelId } from "@/lib/games/model-catalog"

type ChatComposerProps = {
  value: string
  onValueChange: (value: string) => void
  onSubmit: (value: string) => void
  // Appelé quand on clique sur le bouton pendant une génération (`pending`).
  onStop?: () => void
  pending?: boolean
  error?: string | null
  // Absents sur le composer d'accueil (`new-game-composer.tsx`) : la partie
  // n'existe pas encore, donc rien ne consomme ce choix. Le sélecteur ne
  // s'affiche alors pas plutôt que de proposer un choix sans effet.
  modelId?: GameModelId
  onModelChange?: (id: GameModelId) => void
}

// Composant contrôlé : le parent possède la valeur et décide quoi faire à
// l'envoi (créer une partie, envoyer un message…).
export function ChatComposer({
  value,
  onValueChange,
  onSubmit,
  onStop,
  pending = false,
  error = null,
  modelId,
  onModelChange,
}: ChatComposerProps) {
  const selectedModel = modelId
    ? (GAME_MODELS.find((model) => model.id === modelId) ?? GAME_MODELS[0])
    : null

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // `requestSubmit()` passe outre le bouton désactivé : on bloque ici un
    // second envoi pendant que le premier est en cours.
    if (pending) return
    onSubmit(value)
  }

  // Entrée envoie, Maj+Entrée va à la ligne. Pendant une composition IME,
  // Entrée valide le mot en cours et ne doit pas envoyer.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return
    }

    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <InputGroup className="bg-popover">
        <InputGroupTextarea
          name="prompt"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the game you want to build…"
          rows={1}
          className="field-sizing-content max-h-48 min-h-10"
          aria-invalid={Boolean(error)}
        />
        <InputGroupAddon align="block-end">
          {selectedModel && onModelChange ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<InputGroupButton variant="ghost" size="sm" />}
              >
                <GripIcon />
                {selectedModel.name}
                <ChevronDownIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {GAME_MODELS.map((model) => (
                  <DropdownMenuItem
                    key={model.id}
                    onClick={() => onModelChange(model.id)}
                  >
                    {model.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {/* Pendant une génération, le bouton d'envoi devient un bouton stop. */}
          <InputGroupButton
            type={pending ? "button" : "submit"}
            variant="default"
            size="icon-sm"
            className="ml-auto rounded-full"
            aria-label={pending ? "Stop generating" : "Send message"}
            onClick={pending ? onStop : undefined}
          >
            {pending ? (
              <SquareIcon className="fill-current" />
            ) : (
              <ArrowUpIcon />
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      {error ? (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  )
}
