import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const metadata = { title: "Sign in | NovaWorks" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "AGENT" ? "/tasks" : "/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <p className="text-2xl font-bold tracking-tight text-navy-900">NovaWorks</p>
        <p className="mb-6 text-sm text-slate-500">AI Project Manager · Meeting to Execution</p>
        <LoginForm />
        <p className="mt-6 text-center text-xs text-slate-400">Demo accounts are listed in the README.</p>
      </div>
    </main>
  );
}
