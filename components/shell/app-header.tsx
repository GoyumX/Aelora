"use client";

import { Bell, ChevronDown, MapPin, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { MobileNavigation } from "@/components/shell/mobile-navigation";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import type { UserRole } from "@/lib/auth/authorization";

type AppHeaderProps = {
  alertCount?: number;
  siteName?: string;
  user?: { name: string; email: string };
  role?: UserRole;
};

export function AppHeader({
  alertCount = 0,
  siteName = "No site configured",
  user = { name: "Aelora User", email: "" },
  role = "USER",
}: AppHeaderProps) {
  const router = useRouter();
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  async function signOut() {
    await authClient.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <MobileNavigation alertCount={alertCount} role={role} />
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
            <span className="truncate">{siteName}</span>
            <ChevronDown aria-hidden="true" className="size-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Solar sites</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>{siteName}</DropdownMenuItem>
              <DropdownMenuItem disabled>Add a site in Configuration</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <Link
          aria-label={alertCount ? `View notifications, ${alertCount} open alerts` : "View notifications"}
          className={buttonVariants({ className: "relative size-10", size: "icon", variant: "ghost" })}
          href="/alerts"
        >
          <Bell aria-hidden="true" className="size-4.5" />
          {alertCount > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-alert-critical ring-2 ring-background" />}
        </Link>
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
                {initials || <UserRound aria-hidden="true" className="size-4" />}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">{user.name}</span>
            <ChevronDown
              aria-hidden="true"
              className="hidden size-3.5 opacity-60 sm:block"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <span className="block">{user.name}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">{user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/settings#profile" />}>Profile settings</DropdownMenuItem>
              <DropdownMenuItem onClick={signOut}>Sign out</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
