import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/format";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <Sidebar
        user={{
          name: user.name,
          roleLabel: ROLE_LABEL[user.role] ?? user.role,
          isAdmin: user.role === "ADMIN",
        }}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 md:ml-64 md:py-10">{children}</main>
    </div>
  );
}
