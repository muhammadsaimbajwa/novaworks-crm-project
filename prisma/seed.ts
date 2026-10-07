import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Demo123!";

type SeedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  specialization: string;
  skills: string[];
};

const users: SeedUser[] = [
  { id: "ADMIN01", name: "Admin", email: "admin@novaworks.example", role: "ADMIN", specialization: "Company overview, transcript creation", skills: [] },

  { id: "PM01", name: "Ayesha Khan", email: "ayesha@novaworks.example", role: "MANAGER", specialization: "Web PM", skills: ["Web projects", "Client coordination"] },
  { id: "PM02", name: "Bilal Ahmed", email: "bilal@novaworks.example", role: "MANAGER", specialization: "Mobile PM", skills: ["Mobile projects", "Delivery planning"] },
  { id: "PM03", name: "Hina Malik", email: "hina@novaworks.example", role: "MANAGER", specialization: "AI PM", skills: ["AI projects", "Requirement review"] },

  { id: "DEV01", name: "Ali Raza", email: "ali@novaworks.example", role: "AGENT", specialization: "Full-Stack", skills: ["React", "Frontend", "Integration"] },
  { id: "DEV02", name: "Hamza Shah", email: "hamza@novaworks.example", role: "AGENT", specialization: "Full-Stack", skills: ["Node.js", "Databases", "APIs"] },
  { id: "DEV03", name: "Sara Noor", email: "sara@novaworks.example", role: "AGENT", specialization: "App Developer", skills: ["Flutter", "Mobile UI"] },
  { id: "DEV04", name: "Usman Tariq", email: "usman@novaworks.example", role: "AGENT", specialization: "App Developer", skills: ["Flutter", "Integration", "Testing"] },
  { id: "DEV05", name: "Zain Abbas", email: "zain@novaworks.example", role: "AGENT", specialization: "AI Developer", skills: ["LLMs", "Extraction", "Prompts"] },
  { id: "DEV06", name: "Maryam Asif", email: "maryam@novaworks.example", role: "AGENT", specialization: "AI Developer", skills: ["Retrieval", "Document processing"] },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // Idempotent: upsert by id, so running the seed repeatedly never creates duplicates.
  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        name: user.name,
        email: user.email,
        role: user.role,
        specialization: user.specialization,
        skills: user.skills,
        passwordHash,
      },
      create: { ...user, passwordHash },
    });
  }

  console.log(`Seeded ${users.length} users (password for all: ${DEMO_PASSWORD}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
