/**
 * Better Auth configuration for Tome
 * Uses username/password auth with SQLite storage
 * 
 * Note: This file uses bun:sqlite for runtime. For CLI migrations,
 * use the root auth.ts which uses better-sqlite3.
 */
import { Database } from "bun:sqlite";
import { DB_PATH, AUTH_USERNAME, AUTH_PASSWORD, AUTH_ENABLED, BETTER_AUTH_SECRET, BETTER_AUTH_URL } from "../config";
import { readSession, sessionSecret, type SessionRow, type SessionUser } from "./session";

// Initialize database (bun:sqlite for runtime performance)
const db = new Database(DB_PATH);

// Warn if no secret is set in production
if (process.env.NODE_ENV === "production" && !BETTER_AUTH_SECRET) {
  console.warn("WARNING: BETTER_AUTH_SECRET not set. Sessions will not persist across restarts.");
}

function createAuth(
  betterAuth: typeof import("better-auth").betterAuth,
  username: typeof import("better-auth/plugins/username").username,
) {
  return betterAuth({
    database: db,
    secret: BETTER_AUTH_SECRET || undefined,
    baseURL: BETTER_AUTH_URL || undefined,
    emailAndPassword: {
      enabled: true,
    },
    plugins: [username()],
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "user",
          input: false,
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 365,
      updateAge: 60 * 60 * 24,
    },
    emailVerification: {
      sendVerificationEmail: async () => {},
    },
  });
}

let authInstance: Promise<ReturnType<typeof createAuth>> | null = null;

/**
 * better-auth, loaded on first use: sign-in, sign-out, invites and its own
 * /api/auth routes. Request authentication goes through getSession, which does
 * not need it, so a restarted server whose readers keep their cookies never
 * loads it (~45MB of modules, measured).
 */
export function getAuth(): Promise<ReturnType<typeof createAuth>> {
  authInstance ??= Promise.all([import("better-auth"), import("better-auth/plugins/username")])
    .then(([{ betterAuth }, { username }]) => createAuth(betterAuth, username));
  return authInstance;
}

export async function seedAdminUser(): Promise<void> {
  if (!AUTH_ENABLED) {
    console.log("Auth disabled (no AUTH_USERNAME/AUTH_PASSWORD set)");
    return;
  }

  try {
    const existingUser = db
      .query("SELECT id, role FROM user WHERE username = ?")
      .get(AUTH_USERNAME) as { id: string; role: string | null } | null;

    if (existingUser) {
      if (existingUser.role !== "admin") {
        db.run("UPDATE user SET role = 'admin' WHERE id = ?", [existingUser.id]);
        console.log(`Admin user '${AUTH_USERNAME}' role updated to 'admin'`);
      } else {
        console.log(`Admin user '${AUTH_USERNAME}' already exists`);
      }
      return;
    }

    const email = `${AUTH_USERNAME}@tome.local`;
    
    const response = await (await getAuth()).api.signUpEmail({
      body: {
        email,
        password: AUTH_PASSWORD,
        name: AUTH_USERNAME,
        username: AUTH_USERNAME,
      },
    });

    if (response?.user) {
      db.run("UPDATE user SET role = 'admin' WHERE id = ?", [response.user.id]);
      console.log(`Admin user '${AUTH_USERNAME}' created successfully`);
    } else {
      console.error("Failed to create admin user:", response);
    }
  } catch (error: any) {
    const errorMsg = error?.message || error?.body?.message || "";
    if (
      errorMsg.includes("Sign up is disabled") ||
      errorMsg.includes("sign up is not enabled")
    ) {
      console.log("Signup disabled, creating admin user directly...");
      await createAdminUserDirectly();
    } else {
      console.error("Error seeding admin user:", error);
    }
  }
}

async function createAdminUserDirectly(): Promise<void> {
  const email = `${AUTH_USERNAME}@inkwell.local`;
  const userId = crypto.randomUUID();
  const now = Date.now();

  const { hashPassword } = await import("better-auth/crypto");
  const hashedPassword = await hashPassword(AUTH_PASSWORD);

  try {
    db.run(
      `INSERT INTO user (id, email, emailVerified, name, username, role, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, email, 1, AUTH_USERNAME, AUTH_USERNAME, "admin", now, now]
    );

    db.run(
      `INSERT INTO account (id, userId, accountId, providerId, password, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        userId,
        userId,
        "credential",
        hashedPassword,
        now,
        now,
      ]
    );

    console.log(`Admin user '${AUTH_USERNAME}' created successfully`);
  } catch (error) {
    console.error("Failed to create admin user directly:", error);
  }
}

// db.query caches the statement; prepared on use so a fresh DB can migrate first.
const findSession = (token: string) =>
  db.query(
    "SELECT s.userId AS userId, u.role AS role, s.expiresAt AS expiresAt FROM session s JOIN user u ON u.id = s.userId WHERE s.token = ?",
  ).get(token) as SessionRow | null;

/** The signed-in user for a request, or null (see ./session). */
export async function getSession(req: Request): Promise<SessionUser | null> {
  // Secret rotation (BETTER_AUTH_SECRETS) has its own rules: leave it to better-auth.
  if (process.env.BETTER_AUTH_SECRETS) {
    return (await (await getAuth()).api.getSession({ headers: req.headers })) as SessionUser | null;
  }
  return readSession(req.headers.get("cookie"), sessionSecret(), findSession);
}

export async function createUser(
  email: string,
  username: string,
  password: string,
  role: "user" | "admin" = "user"
): Promise<{ id: string } | null> {
  const userId = crypto.randomUUID();
  const now = Date.now();

  const { hashPassword } = await import("better-auth/crypto");
  const hashedPassword = await hashPassword(password);

  try {
    db.run(
      `INSERT INTO user (id, email, emailVerified, name, username, role, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, email, 1, username, username, role, now, now]
    );

    db.run(
      `INSERT INTO account (id, userId, accountId, providerId, password, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        userId,
        userId,
        "credential",
        hashedPassword,
        now,
        now,
      ]
    );

    console.log(`User '${username}' created with role '${role}'`);
    return { id: userId };
  } catch (error: any) {
    if (error?.message?.includes("UNIQUE constraint failed")) {
      console.error(`User creation failed: username or email already exists`);
    } else {
      console.error("Failed to create user:", error);
    }
    return null;
  }
}

export { AUTH_ENABLED };
