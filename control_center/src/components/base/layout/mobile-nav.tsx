"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/base/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/base/ui/sheet"
import { Sidebar } from "./sidebar"

export function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden hover:bg-secondary transition-all duration-300">
          <Menu className="w-6 h-6" />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-64">
        <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
        <SheetDescription className="sr-only">Thanh menu điều hướng trên thiết bị di động</SheetDescription>
        <Sidebar />
      </SheetContent>
    </Sheet>
  )
}
