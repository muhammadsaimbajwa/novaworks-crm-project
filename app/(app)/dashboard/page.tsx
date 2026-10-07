import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProjectsForUser } from "@/lib/permissions";
import { greeting } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import ProjectCard from "@/components/ProjectCard";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const projects = await getProjectsForUser(user);
  const isAdmin = user.role === "ADMIN";

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.name}`}
        subtitle="Turn meeting discussions into executable work."
        action={
          isAdmin ? (
            <Link
              href="/admin/transcript"
              className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              + Create from Transcript
            </Link>
          ) : undefined
        }
      />

      <h2 className="mb-4 text-lg font-semibold text-navy-900">Projects</h2>
      {projects.length === 0 ? (
        <EmptyState
          message={
            isAdmin
              ? "No projects yet. Create your first project from a meeting transcript."
              : user.role === "MANAGER"
                ? "No projects assigned yet."
                : "No tasks assigned yet."
          }
          actionHref={isAdmin ? "/admin/transcript" : undefined}
          actionLabel={isAdmin ? "Create from Transcript" : undefined}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </>
  );
}
