import Link from "next/link";
import { formatDate, initials } from "@/lib/format";

export type ProjectCardData = {
  id: string;
  name: string;
  clientName: string;
  deadline: Date;
  taskCount: number;
  manager: { name: string };
};

export default function ProjectCard({ project }: { project: ProjectCardData }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
    >
      <h3 className="text-lg font-semibold text-navy-900 group-hover:text-indigo-600">{project.name}</h3>

      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Client</dt>
          <dd className="font-medium text-slate-700">{project.clientName}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Manager</dt>
          <dd className="mt-0.5 flex items-center gap-2 font-medium text-slate-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
              {initials(project.manager.name)}
            </span>
            {project.manager.name}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
        <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
          Due {formatDate(project.deadline)}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
          {project.taskCount} {project.taskCount === 1 ? "task" : "tasks"}
        </span>
      </div>
    </Link>
  );
}
