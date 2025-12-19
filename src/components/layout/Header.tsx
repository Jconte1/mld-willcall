// components/layout/Header.tsx
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Users } from 'lucide-react';
import BrandMark from "@/components/brand/BrandMark";
import { cn } from '@/lib/utils';

const Header: React.FC = () => {
  const isStaffRoute = (usePathname() ?? '').startsWith('/staff');

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/80 backdrop-blur-lg">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <BrandMark size={60} className="group-hover:opacity-90 transition-opacity" />
          <span className="font-display text-xl font-semibold text-foreground">
            Will<span className="text-primary">Call</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              !isStaffRoute
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Schedule</span>
          </Link>

          <Link
            href="/staff"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              isStaffRoute
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Staff</span>
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;
