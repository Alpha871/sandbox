"use client"

import { startTransition, useActionState, useState } from "react"

import { ChatComposer } from "@/components/chat-composer"
import { Button } from "@/components/ui/button"
import { createGame, type CreateGameState } from "@/lib/games/actions"
import { suggestions } from "@/lib/games/suggestions"
import { usePreferredModel } from "@/lib/games/use-preferred-model"

const initialState: CreateGameState = { status: "idle", message: null }

/**
 * Client boundary for the home page composer: a Server Component cannot hand
 * `ChatComposer` its `onValueChange` / `onSubmit` callbacks, so the prompt state
 * and the `createGame` call live here.
 */
export function NewGameComposer() {
  const [state, formAction, pending] = useActionState(createGame, initialState)
  const [prompt, setPrompt] = useState("")
  // Le choix n'est pas envoyé à `createGame` : il est déjà dans `localStorage`
  // au moment où `ChatThread` (même hook) monte sur la partie créée.
  const [modelId, setModelId] = usePreferredModel()

  function submitPrompt(value: string) {
    const formData = new FormData()
    formData.set("prompt", value)

    // Hors d'un <form action>, le dispatch de useActionState doit être
    // appelé dans une transition.
    startTransition(() => formAction(formData))
  }

  return (
    <>
      <ChatComposer
        value={prompt}
        onValueChange={setPrompt}
        onSubmit={submitPrompt}
        pending={pending}
        modelId={modelId}
        onModelChange={setModelId}
        error={state.status === "error" ? state.message : null}
      />
      <div className="flex flex-wrap items-center justify-center gap-2">
        {suggestions.map(({ icon: Icon, label, prompt: suggestionPrompt }) => (
          <Button
            key={label}
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full font-normal text-muted-foreground"
            disabled={pending}
            onClick={() => submitPrompt(suggestionPrompt)}
          >
            <Icon data-icon="inline-start" />
            {label}
          </Button>
        ))}
      </div>
    </>
  )
}
