"use client"

import { ArrowUpIcon, ChevronDownIcon, GripIcon } from "lucide-react"
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
import { Spinner } from "@/components/ui/spinner"

type ChatComposerProps = {
  value: string
  onValueChange: (value: string) => void
  onSubmit: (value: string) => void
  pending?: boolean
  error?: string | null
}

// Composant contrôlé : le parent possède la valeur et décide quoi faire à
// l'envoi (créer une partie, envoyer un message…).
export function ChatComposer({
  value,
  onValueChange,
  onSubmit,
  pending = false,
  error = null,
}: ChatComposerProps) {
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
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<InputGroupButton variant="ghost" size="sm" />}
            >
              <GripIcon />
              Kimi K3
              <ChevronDownIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Kimi K3</DropdownMenuItem>
              <DropdownMenuItem>Claude Opus 5</DropdownMenuItem>
              <DropdownMenuItem>GPT-5.2</DropdownMenuItem>
              <DropdownMenuItem>Gemini 3 Pro</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <InputGroupButton
            type="submit"
            variant="default"
            size="icon-sm"
            className="ml-auto rounded-full"
            aria-label="Send message"
            disabled={pending}
          >
            {pending ? <Spinner /> : <ArrowUpIcon />}
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
