import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
  if (!bootstrapEmail) {
    console.warn("ADMIN_BOOTSTRAP_EMAIL not set. Skipping admin bootstrap.");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: bootstrapEmail } });
  if (existing) {
    if (existing.role !== Role.ADMIN) {
      await prisma.user.update({ where: { id: existing.id }, data: { role: Role.ADMIN } });
      console.warn(`User ${bootstrapEmail} promoted to ADMIN.`);
    } else {
      console.warn(`Admin user ${bootstrapEmail} already exists. Skipping.`);
    }
    return;
  }

  const initialPassword = crypto.randomBytes(12).toString("base64url");
  const passwordHash = await bcrypt.hash(initialPassword, 12);

  await prisma.user.create({
    data: {
      email: bootstrapEmail,
      passwordHash,
      role: Role.ADMIN,
    },
  });

  console.warn("=".repeat(60));
  console.warn("Admin user created.");
  console.warn(`Email   : ${bootstrapEmail}`);
  console.warn(`Password: ${initialPassword}`);
  console.warn("Change this password immediately after first login.");
  console.warn("=".repeat(60));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
