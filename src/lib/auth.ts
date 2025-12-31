/**
 * Better Auth configuration for Tome
 * Uses username/password auth with SQLite storage
 * 
 * Note: This file uses bun:sqlite for runtime. For CLI migrations,
 * use the root auth.ts which uses better-sqlite3.
 */
import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { Database } from "bun:sqlite";
import { DB_PATH, AUTH_USERNAME, AUTH_PASSWORD, AUTH_ENABLED } from "../config";

// Initialize database (bun:sqlite for runtime performance)
const db = new Database(DB_PATH);

export const auth = betterAuth({
  database: db,
  emailAndPassword: {
    enabled: true,
    // Disable public signup - admin is seeded from env vars
    disableSignUp: true,
  },
  plugins: [username()],
  session: {
    // Sessions last ~1 year (within Better Auth's 400 day limit)
    expiresIn: 60 * 60 * 24 * 365,
    // Refresh session expiry every day
    updateAge: 60 * 60 * 24,
  },
  // Disable email verification (not needed for single admin user)
  emailVerification: {
    sendVerificationEmail: async () => {
      // No-op: we don't send emails
    },
  },
});

/**
 * Seed the admin user from environment variables
 * Called on startup, creates user if not exists
 */
export async function seedAdminUser(): Promise<void> {
  if (!AUTH_ENABLED) {
    console.log("Auth disabled (no AUTH_USERNAME/AUTH_PASSWORD set)");
    return;
  }

  try {
    // Check if admin user already exists by username
    const existingUser = db
      .query("SELECT id FROM user WHERE username = ?")
      .get(AUTH_USERNAME);

    if (existingUser) {
      console.log(`Admin user '${AUTH_USERNAME}' already exists`);
      return;
    }

    // Create admin user using Better Auth's internal API
    // We need to use the sign-up endpoint since createUser requires admin plugin
    const email = `${AUTH_USERNAME}@tome.local`;
    
    const response = await auth.api.signUpEmail({
      body: {
        email,
        password: AUTH_PASSWORD,
        name: AUTH_USERNAME,
        username: AUTH_USERNAME,
      },
    });

    if (response?.user) {
      console.log(`Admin user '${AUTH_USERNAME}' created successfully`);
    } else {
      console.error("Failed to create admin user:", response);
    }
  } catch (error: any) {
    // If signup is disabled and user doesn't exist, we need to create directly
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

/**
 * Create admin user directly in the database
 * Fallback when signup is disabled
 */
async function createAdminUserDirectly(): Promise<void> {
  const email = `${AUTH_USERNAME}@inkwell.local`;
  const userId = crypto.randomUUID();
  const now = Date.now();

  // Hash password using Better Auth's password hasher
  const { hashPassword } = await import("better-auth/crypto");
  const hashedPassword = await hashPassword(AUTH_PASSWORD);

  try {
    // Insert user (bun:sqlite uses .run() with array params)
    db.run(
      `INSERT INTO user (id, email, emailVerified, name, username, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, email, 1, AUTH_USERNAME, AUTH_USERNAME, now, now]
    );

    // Insert account (for email/password auth)
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

/**
 * Validate session from request headers
 * Returns session data or null if not authenticated
 */
export async function getSession(req: Request) {
  return auth.api.getSession({
    headers: req.headers,
  });
}

export { AUTH_ENABLED };
