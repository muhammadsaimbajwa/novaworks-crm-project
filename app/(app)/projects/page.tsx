import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProjectsForUser } from "@/lib/permissions";
import PageHeader from "@/components/PageHeader";
import ProjectCard from "@/components/ProjectCard";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const projects = await getProjectsForUser(user);
  const isAdmin = user.role === "ADMIN";

  const subtitle =
    user.role === "ADMIN"
      ? "All projects across NovaWorks."
      : user.role === "MANAGER"
        ? "Projects you manage."
        : "Projects that contain tasks assigned to you.";

  return (
    <>
      <PageHeader title="Projects" subtitle={subtitle} />
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
