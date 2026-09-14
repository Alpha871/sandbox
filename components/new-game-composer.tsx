"use client"

import { startTransition, useActionState, useEffect, useState } from "react"

import { ChatComposer } from "@/components/chat-composer"
import { Button } from "@/components/ui/button"
import { createGame, type CreateGameState } from "@/lib/games/actions"
import { suggestions } from "@/lib/games/suggestions"

const initialState: CreateGameState = { status: "idle", message: null }

/**
 * Client boundary for the home page composer: a Server Component cannot hand
 * `ChatComposer` its `onValueChange` / `onSubmit` callbacks, so the prompt state
 * and the `createGame` call live here.
 */
export function NewGameComposer() {
  const [state, formAction, pending] = useActionState(createGame, initialState)
  const [prompt, setPrompt] = useState("")

  useEffect(() => {
    if (state.status === "success") {
      setPrompt("")
    }
  }, [state])

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
        error={state.status === "error" ? state.message : null}
      />
      <div className="flex flex-wrap items-center justify-center gap-2">
        {suggestions.map(({ icon: Icon, label }) => (
          <Button
            key={label}
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full font-normal text-muted-foreground"
            disabled={pending}
            onClick={() => submitPrompt(label)}
          >
            <Icon data-icon="inline-start" />
            {label}
          </Button>
        ))}
      </div>
    </>
  )
}
