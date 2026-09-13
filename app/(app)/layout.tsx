import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { listGames } from "@/lib/games/queries"

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Promesse volontairement non attendue : `AppSidebar` la consomme sous un
  // `<Suspense>`, ce qui laisse la page s'afficher sans attendre la base.
  const games = listGames()

  return (
    <SidebarProvider>
      <AppSidebar games={games} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
