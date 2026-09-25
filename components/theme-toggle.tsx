"use client"

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenuButton } from "@/components/ui/sidebar"

const THEMES = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const

// Le choix est enregistré par `next-themes` (localStorage) et lu par le script
// qu'il injecte avant l'hydratation : il vaut aussi pour les pages de connexion.
export function ThemeToggle() {
  // `theme` est `undefined` au rendu serveur. Le groupe retombe sur `system`
  // (le défaut du provider) et l'icône du bouton suit la classe `dark` du
  // document via CSS, pour ne pas diverger de l'HTML serveur à l'hydratation.
  const { theme = "system", setTheme } = useTheme()

  return (
    // Pas de `tooltip` sur le bouton : le menu est déjà son libellé, et deux
    // overlays sur le même déclencheur se disputeraient le focus.
    <DropdownMenu>
      <DropdownMenuTrigger render={<SidebarMenuButton />}>
        <SunIcon className="dark:hidden" />
        <MoonIcon className="hidden dark:block" />
        <span>Theme</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-40">
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          {THEMES.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
