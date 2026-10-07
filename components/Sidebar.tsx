"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { initials } from "@/lib/format";

type Props = { user: { name: string; roleLabel: string; isAdmin: boolean } };

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/tasks", label: "My Tasks" },
  { href: "/team", label: "Team" },
];

export default function Sidebar({ user }: Props) {
  const pathname = usePathname();

  const link = (href: string, label: string, highlight = false) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
          active
            ? "bg-white/15 text-white"
            : highlight
              ? "text-indigo-200 hover:bg-white/10 hover:text-white"
              : "text-slate-300 hover:bg-white/10 hover:text-white"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <aside className="flex flex-col gap-4 bg-navy-950 p-4 text-white md:fixed md:inset-y-0 md:left-0 md:z-10 md:w-64 md:gap-6 md:p-5">
      <div>
        <p className="text-lg font-bold tracking-tight">NovaWorks</p>
        <p className="text-xs text-slate-400">AI Project Manager</p>
      </div>

      <nav className="flex flex-row flex-wrap gap-1 md:flex-col">
        {NAV.map((item) => link(item.href, item.label))}
        {user.isAdmin && (
          <div className="md:mt-4">
            <p className="mb-1 hidden px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500 md:block">
              Admin
            </p>
            {link("/admin/transcript", "Create from Transcript", true)}
          </div>
        )}
      </nav>

      <div className="flex items-center gap-3 border-t border-white/10 pt-4 md:mt-auto">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold">
          {initials(user.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-slate-400">{user.roleLabel}</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="rounded-md px-2 py-1 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white"
          >
            Logout
          </button>
        </form>
      </div>
    </aside>
  );
}
