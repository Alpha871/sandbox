"use client"

import { ChevronDownIcon, GripIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroupButton } from "@/components/ui/input-group"
import { GAME_MODELS, type GameModelId } from "@/lib/games/model-catalog"

type ModelPickerProps = {
  modelId: GameModelId
  onModelChange: (id: GameModelId) => void
}

// Ne possède pas la sélection : le parent décide où la garder (état local,
// `localStorage` via `usePreferredModel`…).
export function ModelPicker({ modelId, onModelChange }: ModelPickerProps) {
  const selected =
    GAME_MODELS.find((model) => model.id === modelId) ?? GAME_MODELS[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<InputGroupButton variant="ghost" size="sm" />}
      >
        <GripIcon />
        {selected.name}
        <ChevronDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={modelId}
          onValueChange={(value) => onModelChange(value as GameModelId)}
        >
          {GAME_MODELS.map((model) => (
            <DropdownMenuRadioItem key={model.id} value={model.id} closeOnClick>
              <div className="flex flex-col py-0.5">
                <span>{model.name}</span>
                <span className="text-xs text-muted-foreground">
                  {model.tagline}
                </span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
