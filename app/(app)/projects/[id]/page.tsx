import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProjectForUser } from "@/lib/permissions";
import { formatDate, initials } from "@/lib/format";
import TaskRow from "@/components/TaskRow";
import EmptyState from "@/components/EmptyState";
import Forbidden from "@/components/Forbidden";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const access = await getProjectForUser(user, id);

  if (access.status === "not_found") notFound();
  if (access.status === "forbidden") {
    return (
      <Forbidden
        title="Access denied"
        message="You do not have access to this project. It is not one you manage or have tasks in."
      />
    );
  }

  const { project, tasks } = access;
  const isAgent = user.role === "AGENT";

  return (
    <>
      <Link href="/projects" className="text-sm font-medium text-indigo-600 hover:underline">
        ← Back to projects
      </Link>

      <header className="mt-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">{project.name}</h1>
        {project.description && <p className="mt-2 max-w-3xl text-slate-600">{project.description}</p>}

        <dl className="mt-6 grid gap-6 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Client</dt>
            <dd className="mt-1 font-medium text-slate-800">{project.clientName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Manager</dt>
            <dd className="mt-1 flex items-center gap-2 font-medium text-slate-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                {initials(project.manager.name)}
              </span>
              {project.manager.name}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Deadline</dt>
            <dd className="mt-1 font-medium text-slate-800">{formatDate(project.deadline)}</dd>
          </div>
        </dl>
      </header>

      <section className="mt-8">
        <h2 className="mb-1 text-lg font-semibold text-navy-900">
          {isAgent ? "Your tasks in this project" : "Tasks"} ({tasks.length})
        </h2>
        {isAgent && (
          <p className="mb-4 text-sm text-slate-500">You can only see the tasks assigned to you.</p>
        )}
        {tasks.length === 0 ? (
          <EmptyState message="No tasks in this project yet." />
        ) : (
          <ul className="mt-3 space-y-3">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
