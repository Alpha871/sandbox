import {
  CarIcon,
  CrosshairIcon,
  Gamepad2Icon,
  PickaxeIcon,
  PlaneIcon,
  SwordsIcon,
  ZapIcon,
} from "lucide-react"

// Les suggestions sont rendues hors du <form> du composer : elles s'y
// rattachent via l'attribut HTML `form`, qui doit correspondre à cet id.
export const CREATE_GAME_FORM_ID = "create-game-form"

export const suggestions = [
  { icon: PickaxeIcon, label: "Voxel survival" },
  { icon: SwordsIcon, label: "Ink samurai duel" },
  { icon: ZapIcon, label: "Comic-book firefight" },
  { icon: PlaneIcon, label: "Realistic battlefield" },
  { icon: CrosshairIcon, label: "Fight-first shooter" },
  { icon: CarIcon, label: "Jungle expedition drive" },
  { icon: Gamepad2Icon, label: "Sunny kingdom platformer" },
]
