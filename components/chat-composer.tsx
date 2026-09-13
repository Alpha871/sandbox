"use client"

import { ArrowUpIcon, ChevronDownIcon, GripIcon } from "lucide-react"
import { useActionState, useEffect, useState } from "react"

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
import { createGame, type CreateGameState } from "@/lib/games/actions"
import { CREATE_GAME_FORM_ID } from "@/lib/games/suggestions"

const initialState: CreateGameState = { status: "idle", message: null }

export function ChatComposer() {
  const [state, formAction, pending] = useActionState(createGame, initialState)
  // Textarea contrôlé : React vide un formulaire non contrôlé après chaque
  // soumission, ce qui ferait perdre le prompt quand l'action échoue.
  const [prompt, setPrompt] = useState("")

  useEffect(() => {
    if (state.status === "success") {
      setPrompt("")
    }
  }, [state])

  return (
    <form
      id={CREATE_GAME_FORM_ID}
      action={formAction}
      className="flex w-full flex-col gap-4"
    >
      <InputGroup className="bg-popover">
        <InputGroupTextarea
          name="prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Describe the game you want to build…"
          rows={1}
          className="max-h48 field-sizing-content min-h-10"
          aria-invalid={state.status === "error"}
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

      {state.status === "error" && state.message ? (
        <p role="alert" className="text-center text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
