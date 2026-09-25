"use client"

import { startTransition, useActionState, useEffect, useRef, useState } from "react"
import { MoreHorizontalIcon, PencilIcon, TrashIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { Game } from "@/lib/db/schema"
import {
  deleteGameAction,
  renameGameAction,
  type DeleteGameState,
  type RenameGameState,
} from "@/lib/games/actions"

const initialRenameState: RenameGameState = { status: "idle", message: null }
const initialDeleteState: DeleteGameState = { status: "idle", message: null }

export function GameHeader({ game }: { game: Game }) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [title, setTitle] = useState(game.title)

  const [renameState, renameFormAction, renamePending] = useActionState(
    renameGameAction,
    initialRenameState
  )
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteGameAction,
    initialDeleteState
  )

  // `renameGameAction` ne renvoie rien de distinct en cas de succès : on
  // détecte la fin d'une soumission réussie via la transition pending → idle.
  const wasRenamePending = useRef(false)
  useEffect(() => {
    if (
      wasRenamePending.current &&
      !renamePending &&
      renameState.status === "idle"
    ) {
      setRenameOpen(false)
    }
    wasRenamePending.current = renamePending
  }, [renamePending, renameState])

  function submitRename() {
    const formData = new FormData()
    formData.set("id", game.id)
    formData.set("title", title)

    // Hors d'un <form action>, le dispatch de useActionState doit être
    // appelé dans une transition.
    startTransition(() => renameFormAction(formData))
  }

  function submitDelete() {
    const formData = new FormData()
    formData.set("id", game.id)

    startTransition(() => deleteFormAction(formData))
  }

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4 text-sm font-medium">
      <span className="truncate">{game.title}</span>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <MoreHorizontalIcon />
          <span className="sr-only">Game actions</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setTitle(game.title)
              setRenameOpen(true)
            }}
          >
            <PencilIcon />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <TrashIcon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename game</DialogTitle>
            <DialogDescription>
              Choose a new name for &ldquo;{game.title}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={renameState.status === "error"}>
            <Input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  submitRename()
                }
              }}
              disabled={renamePending}
            />
            {renameState.status === "error" && (
              <FieldError>{renameState.message}</FieldError>
            )}
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenameOpen(false)}
              disabled={renamePending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={submitRename} disabled={renamePending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{game.title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the game and its sandbox. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteState.status === "error" && (
            <p className="text-sm text-destructive">{deleteState.message}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={submitDelete}
              disabled={deletePending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  )
}
