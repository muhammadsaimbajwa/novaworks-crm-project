import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProjectForUser } from "@/lib/permissions";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const { id } = await params;
  const access = await getProjectForUser(user, id);

  if (access.status === "not_found") {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  if (access.status === "forbidden") {
    return NextResponse.json({ error: "You do not have access to this project." }, { status: 403 });
  }

  return NextResponse.json({ project: access.project, tasks: access.tasks });
}
