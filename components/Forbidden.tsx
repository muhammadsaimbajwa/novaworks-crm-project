import Link from "next/link";

export default function Forbidden({
  title = "Access denied",
  message = "You do not have permission to view this page.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
      <p className="text-4xl font-bold text-red-500">403</p>
      <h1 className="mt-2 text-xl font-semibold text-navy-900">{title}</h1>
      <p className="mt-2 text-slate-500">{message}</p>
      <Link
        href="/dashboard"
        className="mt-6 inline-block rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
