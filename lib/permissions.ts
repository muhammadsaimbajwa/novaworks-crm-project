import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { SessionUser } from "./auth";

/**
 * Centralized, server-side authorization.
 *
 *  ADMIN   -> everything
 *  MANAGER -> projects where project.managerId === user.id (and all their tasks)
 *  AGENT   -> tasks where task.assigneeId === user.id, plus the projects that contain them
 *
 * Every page and API route reads data through these functions, so changing a URL
 * can never return data the user is not entitled to.
 */

function projectWhereFor(user: SessionUser): Prisma.ProjectWhereInput {
  if (user.role === "ADMIN") return {};
  if (user.role === "MANAGER") return { managerId: user.id };
  return { tasks: { some: { assigneeId: user.id } } };
}

function taskWhereFor(user: SessionUser): Prisma.TaskWhereInput {
  if (user.role === "ADMIN") return {};
  if (user.role === "MANAGER") return { project: { managerId: user.id } };
  return { assigneeId: user.id };
}

export async function getProjectsForUser(user: SessionUser) {
  const projects = await prisma.project.findMany({
    where: projectWhereFor(user),
    orderBy: { createdAt: "asc" },
    include: {
      manager: { select: { id: true, name: true } },
      // Agents only count their own tasks; everyone else counts all visible tasks.
      tasks: { where: taskWhereFor(user), select: { id: true } },
    },
  });

  return projects.map(({ tasks, ...project }) => ({
    ...project,
    taskCount: tasks.length,
  }));
}

export async function getTasksForUser(
  user: SessionUser,
  projectId?: string,
  orderBy: "created" | "deadline" = "deadline",
) {
  const where: Prisma.TaskWhereInput = { ...taskWhereFor(user) };
  if (projectId) where.projectId = projectId;

  return prisma.task.findMany({
    where,
    orderBy:
      orderBy === "created"
        ? [{ createdAt: "asc" }]
        : [{ deadline: "asc" }, { createdAt: "asc" }],
    include: {
      assignee: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, clientName: true } },
    },
  });
}

export type ProjectAccess =
  | { status: "ok"; project: NonNullable<Awaited<ReturnType<typeof loadProject>>>; tasks: Awaited<ReturnType<typeof getTasksForUser>> }
  | { status: "not_found" }
  | { status: "forbidden" };

async function loadProject(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: { manager: { select: { id: true, name: true, specialization: true } } },
  });
}

export async function getProjectForUser(user: SessionUser, projectId: string): Promise<ProjectAccess> {
  const project = await loadProject(projectId);
  if (!project) return { status: "not_found" };

  let allowed = false;
  if (user.role === "ADMIN") {
    allowed = true;
  } else if (user.role === "MANAGER") {
    allowed = project.managerId === user.id;
  } else {
    const mine = await prisma.task.count({
      where: { projectId, assigneeId: user.id },
    });
    allowed = mine > 0;
  }

  if (!allowed) return { status: "forbidden" };

  // Tasks are filtered by role again here (agents only see their own tasks).
  const tasks = await getTasksForUser(user, projectId, "created");
  return { status: "ok", project, tasks };
}
