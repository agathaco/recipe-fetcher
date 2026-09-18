"use client";

// Replaces the plain "Sign out" button in the header with an avatar that
// opens a menu. Only one item for now (Sign out); the menu shape is here so
// later account-level actions (profile, theme, etc.) have somewhere to go
// without another header redesign.

import { LogOut } from "lucide-react";
import { useTransition } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/app/lib/actions";

export function UserMenu({ email }: { email: string }) {
  const [, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar>
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {email[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* Base UI requires GroupLabel to live inside a Group, unlike the
            Radix-based shadcn version this was copied from which allows a
            bare label. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground max-w-48 truncate font-normal">
            {email}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          // logout is a Server Action that redirects; calling it directly
          // (not via a <form>) matches how the other client components here
          // call actions from onClick, e.g. want-to-make-toggle. No try/catch:
          // there's nothing to recover from if it fails, an unexpected throw
          // is left to reach error.tsx, same "expected vs unexpected" split
          // as the rest of the app's error handling.
          onClick={() => startTransition(() => logout())}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
