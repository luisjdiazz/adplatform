"use client";

import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <div />
      <div className="flex items-center gap-4">
        {session?.user && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {session.user.name || session.user.email}
            </span>
            <Badge variant="secondary">{(session.user as any).role}</Badge>
          </div>
        )}
      </div>
    </header>
  );
}
