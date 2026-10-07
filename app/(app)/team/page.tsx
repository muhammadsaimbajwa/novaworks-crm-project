import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABEL, initials } from "@/lib/format";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

const ROLE_STYLE: Record<string, string> = {
  ADMIN: "bg-slate-100 text-slate-700",
  MANAGER: "bg-violet-50 text-violet-700",
  AGENT: "bg-sky-50 text-sky-700",
};

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Read-only directory. Explicit select: never loads email or passwordHash.
  const members = await prisma.user.findMany({
    select: { id: true, name: true, role: true, specialization: true, skills: true },
    orderBy: { id: "asc" },
  });

  return (
    <>
      <PageHeader title="Team" subtitle="The NovaWorks team directory." />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {members.map((member) => (
          <div key={member.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                {initials(member.name)}
              </span>
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-navy-900">{member.name}</h3>
                <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLE[member.role]}`}>
                  {ROLE_LABEL[member.role]}
                </span>
              </div>
            </div>

            <p className="mt-4 text-xs uppercase tracking-wide text-slate-400">Specialization</p>
            <p className="text-sm font-medium text-slate-700">{member.specialization}</p>

            {member.skills.length > 0 && (
              <>
                <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">Skills</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {member.skills.map((skill) => (
                    <span key={skill} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                      {skill}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
