import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import Forbidden from "@/components/Forbidden";
import TranscriptForm from "@/components/TranscriptForm";

export const dynamic = "force-dynamic";

export default async function TranscriptPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Server-side check: non-admins never receive this page (the API enforces it too).
  if (user.role !== "ADMIN") {
    return <Forbidden message="Only administrators can create projects from a meeting transcript." />;
  }

  return (
    <>
      <PageHeader
        title="Create Projects from Meeting"
        subtitle="Paste a meeting transcript and let AI turn decisions into executable work."
      />
      <TranscriptForm />
    </>
  );
}
