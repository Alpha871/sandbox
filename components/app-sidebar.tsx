"use client"

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs"
import { CoinsIcon, MessageSquareIcon, SquarePenIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Suspense, use } from "react"

import { Empty, EmptyDescription } from "@/components/ui/empty"
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { ThemeToggle } from "@/components/theme-toggle"
import type { Game } from "@/lib/db/schema"

export function AppSidebar({ games }: { games: Promise<Game[]> }) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex-row items-center gap-2">
        <Image
          src="/logo.svg"
          alt="Sandbox"
          width={20}
          height={20}
          className="size-5 group-data-[collapsible=icon]:hidden"
        />
        <span className="font-logo text-base group-data-[collapsible=icon]:hidden">
          Sandbox
        </span>
        <SidebarTrigger className="ms-auto" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/"}
                  tooltip="New game"
                  render={<Link href="/" />}
                >
                  <SquarePenIcon />
                  <span>New game</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Recents</SidebarGroupLabel>
          <SidebarGroupContent>
            <Suspense fallback={<RecentGamesSkeleton />}>
              <RecentGames games={games} />
            </Suspense>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Credits">
              <CoinsIcon />
              <span>Credits</span>
            </SidebarMenuButton>
            <SidebarMenuBadge>$1.00</SidebarMenuBadge>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex items-center justify-between gap-2 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <OrganizationSwitcher
              appearance={{
                elements: {
                  rootBox: "w-full! max-w-full",
                  organizationSwitcherTrigger:
                    "w-full! max-w-full justify-between!",
                  organizationPreview: "min-w-0",
                  organizationPreviewTextContainer: "min-w-0",
                  organizationPreviewMainIdentifier: "truncate",
                },
              }}
            />
          </div>
          <UserButton />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

function RecentGames({ games }: { games: Promise<Game[]> }) {
  const items = use(games)
  const pathname = usePathname()

  if (items.length === 0) {
    return (
      <>
        <Empty className="border p-2 group-data-[collapsible=icon]:hidden">
          <EmptyDescription className="text-xs">
            Your games will live here.
          </EmptyDescription>
        </Empty>
        <SidebarMenu className="hidden group-data-[collapsible=icon]:flex">
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Your games will live here.">
              <MessageSquareIcon />
              <span>Recents</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </>
    )
  }

  return (
    <>
      {/* Déployé : la liste tient dans la sidebar. */}
      <SidebarMenu className="group-data-[collapsible=icon]:hidden">
        {items.map((game) => (
          <SidebarMenuItem key={game.id}>
            <SidebarMenuButton
              isActive={pathname === `/games/${game.id}`}
              render={<Link href={`/games/${game.id}`} />}
            >
              <MessageSquareIcon />
              <span>{game.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>

      {/* Replié : un seul bouton, la liste passe dans un popover. */}
      <SidebarMenu className="hidden group-data-[collapsible=icon]:flex">
        <SidebarMenuItem>
          <RecentGamesPopover games={items} pathname={pathname} />
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  )
}

function RecentGamesPopover({
  games,
  pathname,
}: {
  games: Game[]
  pathname: string
}) {
  return (
    <Popover>
      {/* Pas de `tooltip` sur le bouton : le popover est déjà son libellé,
          et deux overlays sur le même déclencheur se disputeraient le focus. */}
      <PopoverTrigger render={<SidebarMenuButton />}>
        <MessageSquareIcon />
        <span>Recents</span>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-64 gap-1 p-1"
      >
        <PopoverTitle className="px-2 pt-1 text-xs text-muted-foreground">
          Recents
        </PopoverTitle>
        {games.map((game) => (
          // `PopoverClose` ferme au clic : le contenu vit dans un portail, un
          // lien nu laisserait le popover ouvert après la navigation.
          <PopoverClose
            key={game.id}
            nativeButton={false}
            render={<Link href={`/games/${game.id}`} />}
            data-active={pathname === `/games/${game.id}` || undefined}
            className="flex items-center gap-2 rounded-md p-2 text-sm outline-hidden hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent data-active:bg-accent data-active:font-medium"
          >
            <MessageSquareIcon className="size-4 shrink-0" />
            <span className="truncate">{game.title}</span>
          </PopoverClose>
        ))}
      </PopoverContent>
    </Popover>
  )
}

// Largeurs figées plutôt qu'aléatoires : le fallback est rendu au SSR puis
// hydraté, deux valeurs différentes déclencheraient une erreur d'hydratation.
const SKELETON_WIDTHS = ["w-4/5", "w-3/5", "w-2/3"]

function RecentGamesSkeleton() {
  return (
    <SidebarMenu className="group-data-[collapsible=icon]:hidden">
      {SKELETON_WIDTHS.map((width) => (
        <SidebarMenuItem key={width}>
          <div className="flex h-8 items-center gap-2 rounded-md p-2">
            <MessageSquareIcon className="size-4 shrink-0 text-muted-foreground/40" />
            <Skeleton className={`h-3 ${width}`} />
          </div>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}
