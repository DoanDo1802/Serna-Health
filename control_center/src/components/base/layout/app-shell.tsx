import type { ReactNode } from "react"
import { Sidebar } from "@/components/base/layout/sidebar"
import { Header } from "@/components/base/layout/header"

interface AppShellProps {
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
}

export function AppShell({ title, description, actions, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 p-3 md:p-4 lg:p-5 lg:ml-64">
        <Header title={title} description={description} actions={actions} />
        <div className="mt-4 md:mt-5 space-y-3 md:space-y-4">{children}</div>
      </main>
    </div>
  )
}
