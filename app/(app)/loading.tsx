export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-64 rounded-lg bg-slate-200" />
      <div className="h-4 w-96 max-w-full rounded bg-slate-200" />
      <div className="grid gap-5 pt-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-44 rounded-2xl bg-slate-200" />
        ))}
      </div>
    </div>
  );
}
