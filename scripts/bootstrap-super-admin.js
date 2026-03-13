const bcrypt = require("bcryptjs");
const { PrismaClient, UserRole } = require("@prisma/client");

const prisma = new PrismaClient();

function getBootstrapConfig() {
  const email = (process.env.SEED_SUPER_ADMIN_EMAIL || "superadmin@cmms.local").trim().toLowerCase();
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD || "ChangeMeNow123!";
  const name = (process.env.SEED_SUPER_ADMIN_NAME || "CMMS Super Admin").trim();

  if (!email || !password || !name) {
    throw new Error("SEED_SUPER_ADMIN_EMAIL, SEED_SUPER_ADMIN_PASSWORD, and SEED_SUPER_ADMIN_NAME must be non-empty.");
  }

  if (password.length < 8) {
    throw new Error("SEED_SUPER_ADMIN_PASSWORD must be at least 8 characters.");
  }

  return { email, password, name };
}

async function main() {
  const config = getBootstrapConfig();
  const existingSuperAdminCount = await prisma.user.count({
    where: {
      role: UserRole.SUPER_ADMIN,
    },
  });

  if (existingSuperAdminCount > 0) {
    console.log("Super Admin bootstrap skipped because a SUPER_ADMIN user already exists.");
    return;
  }

  const passwordHash = await bcrypt.hash(config.password, 12);
  const existingUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: config.email,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    await prisma.user.update({
      where: {
        id: existingUser.id,
      },
      data: {
        name: config.name,
        role: UserRole.SUPER_ADMIN,
        passwordHash,
      },
    });

    console.log(`Super Admin bootstrap upgraded existing user ${config.email}.`);
    return;
  }

  await prisma.user.create({
    data: {
      email: config.email,
      name: config.name,
      role: UserRole.SUPER_ADMIN,
      passwordHash,
    },
  });

  console.log(`Super Admin bootstrap created ${config.email}.`);
}

main()
  .catch((error) => {
    console.error("Super Admin bootstrap failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
