"use client"

import { useEffect, useState } from "react"

type ChatPreviewProps = {
  gameId: string
  /** L'URL reste identique entre les tours : changer la révision recharge l'iframe. */
  revision: number
}

type PreviewState =
  { status: "loading" } | { status: "ready"; url: string } | { status: "error" }

export function ChatPreview({ gameId, revision }: ChatPreviewProps) {
  const [preview, setPreview] = useState<PreviewState>({ status: "loading" })

  useEffect(() => {
    const controller = new AbortController()

    async function loadPreview() {
      try {
        const response = await fetch(`/api/games/${gameId}/preview`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const { url } = (await response.json()) as { url: string }
        setPreview({ status: "ready", url })
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("[preview] chargement impossible", error)
        setPreview({ status: "error" })
      }
    }

    loadPreview()

    return () => controller.abort()
  }, [gameId])

  if (preview.status === "ready") {
    return (
      <iframe
        key={revision}
        src={preview.url}
        title="Aperçu de la partie"
        className="size-full border-0 bg-background"
      />
    )
  }

  return (
    <p className="p-6 text-sm text-muted-foreground">
      {preview.status === "loading"
        ? "Chargement de l'aperçu…"
        : "Aperçu indisponible."}
    </p>
  )
}
