import { slugify } from "@/lib/slugify";
import { db } from "..";
import { appointmentTypes, locations, organizations, userLocationRoles, users } from "../schema";
import { hashPassword } from "@/lib/auth/hash";

const SEED_PASSWORD = "Password123";
const ORG_NAME = "Sunrise Dental Group";

async function seed() {
  console.log("Seeding organization...");
  const [org] = await db
    .insert(organizations)
    .values({ name: ORG_NAME, slug: slugify(ORG_NAME) })
    .returning();

  console.log("Seeding location...");
  const [location] = await db
    .insert(locations)
    .values({ orgId: org.id, name: "Main Street Office" })
    .returning();

  console.log("Seeding services (appointment types)...");
  await db.insert(appointmentTypes).values([
    { locationId: location.id, name: "Checkup", durationMinutes: 30 },
    { locationId: location.id, name: "Cleaning", durationMinutes: 30 },
    { locationId: location.id, name: "Filling", durationMinutes: 45 },
    { locationId: location.id, name: "Root Canal", durationMinutes: 90 },
  ]);

  const passwordHash = await hashPassword(SEED_PASSWORD);

  // Genuine org-wide owner - NOT tied to any location, no row in
  // user_location_roles at all. Access comes entirely from users.isOwner.
  // This is why "owner" no longer appears in staffToSeed below - it's
  // seeded here, separately, exactly once.
  console.log("Seeding organization owner...");
  await db.insert(users).values({
    orgId: org.id,
    email: "owner@gmail.com",
    passwordHash,
    name: "Priya Owner",
    isOwner: true,
  });
  console.log(`  owner        -> owner@gmail.com / ${SEED_PASSWORD}`);

  // "owner" role removed from this list - that value used to go into
  // user_location_roles, but ownership no longer works that way. What
  // used to be the location-level admin is now "manager" instead.
  const staffToSeed = [
    { role: "manager" as const, name: "Olivia Manager", email: "manager@gmail.com" },
    { role: "clinical" as const, name: "Dr. Priya Chen", email: "doctor@gmail.com" },
    { role: "front_office" as const, name: "Frankie Frontdesk", email: "frontoffice@gmail.com" },
  ];

  console.log("Seeding one user per role...");

  for (const staff of staffToSeed) {
    const [user] = await db
      .insert(users)
      .values({
        orgId: org.id,
        email: staff.email,
        passwordHash,
        name: staff.name,
      })
      .returning();

    await db.insert(userLocationRoles).values({
      userId: user.id,
      locationId: location.id,
      role: staff.role,
    });

    console.log(`  ${staff.role.padEnd(12)} -> ${staff.email} / ${SEED_PASSWORD}`);
  }

  console.log("Done seeding.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});