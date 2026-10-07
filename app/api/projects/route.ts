import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProjectsForUser } from "@/lib/permissions";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const projects = await getProjectsForUser(user);
  return NextResponse.json({ projects });
}
