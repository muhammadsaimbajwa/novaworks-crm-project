import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  transcriptRequestSchema,
  validateExtraction,
  ExtractionError,
  type DirectoryUser,
  type ValidatedProject,
} from "@/lib/validation";
import { extractProjectsFromTranscript, AiServiceError, AiOutputError } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

// Server-side guard against double submissions (the button is also disabled in the UI).
let inFlight = false;

/** Calls the AI and validates the result. If the output is unusable, retries once, telling the model what was wrong. */
async function extractAndValidate(transcript: string, directory: DirectoryUser[]): Promise<ValidatedProject[]> {
  let feedback: string | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await extractProjectsFromTranscript(transcript, directory, feedback);
      return validateExtraction(raw, directory);
    } catch (error) {
      const retryable = error instanceof ExtractionError || error instanceof AiOutputError;
      if (!retryable || attempt === 2) throw error;
      feedback = error.message;
    }
  }
  throw new AiOutputError("Unable to create projects. The AI did not return a usable result.");
}

export async function POST(req: Request) {
  // 1. Authentication + authorization: ADMIN only. Role comes from the database, never from the client.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only administrators can create projects from a transcript." }, { status: 403 });
  }

  // 2. Validate input.
  const body = await req.json().catch(() => null);
  const parsedBody = transcriptRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0].message }, { status: 400 });
  }
  const transcript = parsedBody.data.transcript;

  if (inFlight) {
    return NextResponse.json(
      { error: "A transcript is already being processed. Please wait for it to finish." },
      { status: 409 },
    );
  }
  inFlight = true;

  try {
    // 3. Team directory: id, name, role, specialization, skills only. No emails, no password hashes.
    const people = await prisma.user.findMany({
      where: { role: { in: ["MANAGER", "AGENT"] } },
      select: { id: true, name: true, role: true, specialization: true, skills: true },
      orderBy: { id: "asc" },
    });
    const directory: DirectoryUser[] = people;

    // 4. Ask the AI, then validate. One automatic retry if the output is unusable.
    const validated = await extractAndValidate(transcript, directory);

    // 5. Save everything atomically: all projects and tasks, or nothing.
    const baseTime = Date.now();
    let taskTick = 0;
    const created = await prisma.$transaction(
      async (tx) => {
        const projects = [];
        for (const [index, project] of validated.entries()) {
          const record = await tx.project.create({
            data: {
              name: project.name,
              clientName: project.clientName,
              description: project.description,
              managerId: project.managerId,
              deadline: project.deadline,
              createdAt: new Date(baseTime + index), // keeps meeting order
              tasks: {
                create: project.tasks.map((task) => ({
                  title: task.title,
                  description: task.description,
                  assigneeId: task.assigneeId,
                  deadline: task.deadline,
                  estimatedHours: task.estimatedHours,
                  createdAt: new Date(baseTime + taskTick++),
                })),
              },
            },
            select: { id: true, name: true, clientName: true, _count: { select: { tasks: true } } },
          });
          projects.push({ id: record.id, name: record.name, clientName: record.clientName, taskCount: record._count.tasks });
        }
        return projects;
      },
      { timeout: 30_000 },
    );

    return NextResponse.json({
      projectCount: created.length,
      taskCount: created.reduce((sum, p) => sum + p.taskCount, 0),
      projects: created,
    });
  } catch (error) {
    if (error instanceof ExtractionError || error instanceof AiOutputError || error instanceof AiServiceError) {
      const status = error instanceof AiServiceError ? 502 : 422;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("Transcript processing failed:", error);
    return NextResponse.json(
      { error: "Something went wrong while saving to the database. Nothing was created. Please try again." },
      { status: 500 },
    );
  } finally {
    inFlight = false;
  }
}
