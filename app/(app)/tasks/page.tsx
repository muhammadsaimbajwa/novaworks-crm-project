import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getTasksForUser } from "@/lib/permissions";
import PageHeader from "@/components/PageHeader";
import TaskRow from "@/components/TaskRow";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tasks = await getTasksForUser(user);

  // Group by project so the page reads clearly.
  const groups = new Map<string, { project: (typeof tasks)[number]["project"]; tasks: typeof tasks }>();
  for (const task of tasks) {
    const group = groups.get(task.projectId) ?? { project: task.project, tasks: [] };
    group.tasks.push(task);
    groups.set(task.projectId, group);
  }

  const title = user.role === "AGENT" ? "My Tasks" : user.role === "MANAGER" ? "Tasks in My Projects" : "All Tasks";
  const subtitle =
    user.role === "AGENT"
      ? "Work assigned to you across all projects."
      : user.role === "MANAGER"
        ? "Every task in the projects you manage."
        : "Every task across NovaWorks.";

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      {tasks.length === 0 ? (
        <EmptyState message="No tasks assigned yet." />
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([projectId, group]) => (
            <section key={projectId}>
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className="text-lg font-semibold text-navy-900">
                  <Link href={`/projects/${projectId}`} className="hover:text-indigo-600">
                    {group.project.name}
                  </Link>
                </h2>
                <span className="text-sm text-slate-500">{group.project.clientName}</span>
              </div>
              <ul className="space-y-3">
                {group.tasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
