import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getActiveOrgBalance } from "@/lib/billing/ledger"
import { listGames } from "@/lib/games/queries"

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Promesses volontairement non attendues : `AppSidebar` les consomme sous
  // un `<Suspense>`, ce qui laisse la page s'afficher sans attendre la base.
  // Pas de réconciliation ici (voir `app/(app)/billing/page.tsx`) : ce
  // layout entoure chaque page, il ne doit pas appeler l'API Clerk à chaque
  // navigation.
  const games = listGames()
  const credits = getActiveOrgBalance()

  return (
    <SidebarProvider className="h-svh">
      <AppSidebar games={games} credits={credits} />
      <SidebarInset className="min-h-0">{children}</SidebarInset>
    </SidebarProvider>
  )
}
