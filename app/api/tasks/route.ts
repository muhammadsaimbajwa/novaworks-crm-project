import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getTasksForUser } from "@/lib/permissions";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  // projectId is only a filter; the permission layer still restricts rows to what this user may see.
  const projectId = new URL(req.url).searchParams.get("projectId") ?? undefined;
  const tasks = await getTasksForUser(user, projectId);
  return NextResponse.json({ tasks });
}
