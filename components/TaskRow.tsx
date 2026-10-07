import { formatDate, formatHours, initials } from "@/lib/format";

export type TaskRowData = {
  id: string;
  title: string;
  description: string;
  deadline: Date;
  estimatedHours: number;
  assignee: { name: string };
};

export default function TaskRow({ task }: { task: TaskRowData }) {
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 className="font-semibold text-navy-900">{task.title}</h3>
        <p className="mt-1 text-sm text-slate-500">{task.description}</p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs font-medium">
        <span className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-200 text-[8px] font-bold">
            {initials(task.assignee.name)}
          </span>
          {task.assignee.name}
        </span>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{formatHours(task.estimatedHours)}</span>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">Due {formatDate(task.deadline)}</span>
      </div>
    </li>
  );
}
