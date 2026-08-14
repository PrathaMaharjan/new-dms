// src/db/seed/superadmin.ts
import { db } from "../index";
import { platformAdmins } from "../schema";
import { hashPassword } from "../../lib/auth/hash";

const SUPERADMIN_PASSWORD = "SuperAdmin123";

export async function seedSuperAdmin() {
  console.log("Seeding platform superadmin...");

  const passwordHash = await hashPassword(SUPERADMIN_PASSWORD);

  const [admin] = await db
    .insert(platformAdmins)
    .values({
      email: "superadmin@platform.com",
      passwordHash,
      name: "Platform Super Admin",
    })
    .returning();

  console.log(
    `  superadmin -> superadmin@platform.com / ${SUPERADMIN_PASSWORD}`,
  );

  return admin;
}

async function run() {
  await seedSuperAdmin();
  console.log("Done.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Superadmin seed failed:", err);
  process.exit(1);
});