import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export const transcriptRequestSchema = z.object({
  transcript: z
    .string()
    .trim()
    .min(1, "The transcript is empty. Paste a meeting transcript first.")
    .max(60000, "The transcript is too long (60,000 characters max)."),
});

const dateString = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date in YYYY-MM-DD format");

const taskSchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  description: z.string().trim().min(1, "description is required"),
  assigneeId: z.string().trim().min(1, "assigneeId is required"),
  deadline: dateString,
  estimatedHours: z.coerce.number({ invalid_type_error: "must be a number" }).positive("must be greater than 0"),
});

const projectSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  clientName: z.string().trim().min(1, "clientName is required"),
  description: z.string().trim().default(""),
  managerId: z.string().trim().min(1, "managerId is required"),
  deadline: dateString,
  tasks: z.array(taskSchema),
});

export const extractionSchema = z.object({
  projects: z.array(projectSchema).min(1, "no projects were found"),
});

export type DirectoryUser = {
  id: string;
  name: string;
  role: "ADMIN" | "MANAGER" | "AGENT";
  specialization: string;
  skills: string[];
};

export type ValidatedTask = {
  title: string;
  description: string;
  assigneeId: string;
  deadline: Date;
  estimatedHours: number;
};

export type ValidatedProject = {
  name: string;
  clientName: string;
  description: string;
  managerId: string;
  deadline: Date;
  tasks: ValidatedTask[];
};

/** A problem with the AI output that we can show to the admin (and feed back to the model). */
export class ExtractionError extends Error {}

/** Parses YYYY-MM-DD as a real calendar date (UTC midnight). Returns null if invalid (e.g. 2026-02-31). */
export function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() !== Number(m) - 1 ||
    date.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return date;
}

type Json = Record<string, unknown>;

const isObj = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** First non-empty value among several possible key names (smaller models sometimes rename keys). */
function pick(obj: Json, keys: string[]): unknown {
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return undefined;
}

/**
 * Maps whatever the model wrote for a person (an id like "DEV01", or a name like "Ali Raza" / "Ali")
 * to a real directory id. Unknown people are returned unchanged, so validation still rejects them.
 */
function resolveUserId(value: unknown, users: DirectoryUser[]): unknown {
  if (typeof value !== "string") return value;
  const text = value.trim();
  const lower = text.toLowerCase();

  const byId = users.find((u) => u.id.toLowerCase() === lower);
  if (byId) return byId.id;

  const byName = users.find((u) => u.name.toLowerCase() === lower);
  if (byName) return byName.id;

  const firstName = lower.split(/\s+/)[0];
  const byFirstName = users.filter((u) => u.name.toLowerCase().split(/\s+/)[0] === firstName);
  return byFirstName.length === 1 ? byFirstName[0].id : text;
}

/** Tolerates common key-name variations and names-instead-of-ids before strict validation. */
function normalizeExtraction(raw: unknown, users: DirectoryUser[]): unknown {
  const root: unknown = Array.isArray(raw) ? { projects: raw } : raw;
  if (!isObj(root)) return root;

  const projects = root.projects ?? root.Projects;
  if (!Array.isArray(projects)) return root;

  return {
    projects: projects.map((project) => {
      if (!isObj(project)) return project;
      const tasks = project.tasks ?? project.Tasks;
      return {
        name: pick(project, ["name", "projectName", "project_name", "title"]),
        clientName: pick(project, ["clientName", "client_name", "client", "customer", "customerName"]),
        description: pick(project, ["description", "summary"]) ?? "",
        managerId: resolveUserId(
          pick(project, ["managerId", "manager_id", "manager", "projectManager", "projectManagerId"]),
          users,
        ),
        deadline: pick(project, ["deadline", "dueDate", "due_date"]),
        tasks: Array.isArray(tasks)
          ? tasks.map((task) =>
              isObj(task)
                ? {
                    title: pick(task, ["title", "name", "task"]),
                    description: pick(task, ["description", "details", "summary"]),
                    assigneeId: resolveUserId(
                      pick(task, ["assigneeId", "assignee_id", "assignee", "assignedTo", "developerId", "owner"]),
                      users,
                    ),
                    deadline: pick(task, ["deadline", "dueDate", "due_date"]),
                    estimatedHours: pick(task, ["estimatedHours", "estimated_hours", "hours", "estimate"]),
                  }
                : task,
            )
          : tasks,
      };
    }),
  };
}

const PREFIX = "Unable to create projects.";

/**
 * Validates the raw AI JSON against the schema AND against the real team directory.
 * Throws ExtractionError with a human-readable message on the first problem.
 * Nothing is written to the database here.
 */
export function validateExtraction(rawInput: unknown, users: DirectoryUser[]): ValidatedProject[] {
  const parsed = extractionSchema.safeParse(normalizeExtraction(rawInput, users));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue.path.length ? ` (${issue.path.join(".")})` : "";
    throw new ExtractionError(`${PREFIX} The AI response was incomplete or malformed${where}: ${issue.message}.`);
  }

  const byId = new Map(users.map((u) => [u.id, u]));
  const result: ValidatedProject[] = [];

  for (const project of parsed.data.projects) {
    const manager = byId.get(project.managerId);
    if (!manager) {
      throw new ExtractionError(`${PREFIX} Project '${project.name}' references an unknown manager (${project.managerId}).`);
    }
    if (manager.role !== "MANAGER") {
      throw new ExtractionError(`${PREFIX} Project '${project.name}' is assigned to ${manager.name}, who is not a project manager.`);
    }

    const projectDeadline = parseDate(project.deadline);
    if (!projectDeadline) {
      throw new ExtractionError(`${PREFIX} Project '${project.name}' has an invalid deadline (${project.deadline}).`);
    }

    const tasks: ValidatedTask[] = [];
    for (const task of project.tasks) {
      const assignee = byId.get(task.assigneeId);
      if (!assignee) {
        throw new ExtractionError(`${PREFIX} Task '${task.title}' references an unknown employee (${task.assigneeId}).`);
      }
      if (assignee.role !== "AGENT") {
        throw new ExtractionError(`${PREFIX} Task '${task.title}' is assigned to ${assignee.name}, who is not a developer.`);
      }

      const taskDeadline = parseDate(task.deadline);
      if (!taskDeadline) {
        throw new ExtractionError(`${PREFIX} Task '${task.title}' has an invalid deadline (${task.deadline}).`);
      }
      if (taskDeadline.getTime() > projectDeadline.getTime()) {
        throw new ExtractionError(`${PREFIX} The deadline for task '${task.title}' is later than its project deadline.`);
      }

      tasks.push({
        title: task.title,
        description: task.description,
        assigneeId: task.assigneeId,
        deadline: taskDeadline,
        estimatedHours: task.estimatedHours,
      });
    }

    result.push({
      name: project.name,
      clientName: project.clientName,
      description: project.description,
      managerId: project.managerId,
      deadline: projectDeadline,
      tasks,
    });
  }

  return result;
}
