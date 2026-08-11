"use client";

import { Bell, ChevronDown, MapPin, UserRound } from "lucide-react";

import { MobileNavigation } from "@/components/shell/mobile-navigation";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <MobileNavigation />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label="Select solar site"
                className="max-w-[14rem] justify-start gap-2 px-2.5 sm:px-3"
                variant="ghost"
              />
            }
          >
            <MapPin aria-hidden="true" className="size-4 text-energy-strong" />
            <span className="truncate">Colombo Home</span>
            <ChevronDown aria-hidden="true" className="size-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Solar sites</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Colombo Home</DropdownMenuItem>
            <DropdownMenuItem disabled>Add a site in Configuration</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <Button
          aria-label="View notifications"
          className="relative size-10"
          size="icon"
          variant="ghost"
        >
          <Bell aria-hidden="true" className="size-4.5" />
          <span className="absolute right-2 top-2 size-2 rounded-full bg-alert-critical ring-2 ring-background" />
        </Button>
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label="Open user menu"
                className="h-10 gap-2 px-1.5 sm:pr-2.5"
                variant="ghost"
              />
            }
          >
            <Avatar className="size-7">
              <AvatarFallback>
                <UserRound aria-hidden="true" className="size-4" />
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">Demo User</span>
            <ChevronDown
              aria-hidden="true"
              className="hidden size-3.5 opacity-60 sm:block"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Demo User</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile settings</DropdownMenuItem>
            <DropdownMenuItem disabled>Sign out after auth setup</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

