import type { ReaderSettings } from "../../config";
import { DEFAULT_READER_SETTINGS } from "../../config";

interface InvitePageProps {
  settings?: ReaderSettings;
  token: string;
  email: string;
  error?: string;
  success?: boolean;
}

export function InvitePage({
  settings = DEFAULT_READER_SETTINGS,
  token,
  email,
  error,
  success,
}: InvitePageProps): JSX.Element {
  const darkClass = settings.dark ? "dark-mode" : "";
  const safeError = error;

  return (
    <>
      {"<!DOCTYPE html>"}
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Join Tome</title>
          <link rel="stylesheet" href="/public/css/base.css" />
          <link rel="icon" type="image/x-icon" href="/public/favicon.ico" />
        </head>
        <body class={darkClass || undefined}>
          <div style="max-width: 400px; margin: 60px auto; padding: 0 16px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="border: none; margin: 0;">Tome</h1>
              <p>You've been invited to join Tome.</p>
            </div>

            {success && (
              <div class="success">
                <span>Account created! You can now </span>
                <a href="/login">sign in</a>.
              </div>
            )}

            {safeError && (
              <div class="error">
                <span>{safeError}</span>
              </div>
            )}

            {!success && (
              <form method="POST" action={`/invite/${token}`}>
                <div class="form-group">
                  <label for="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={email}
                    readonly
                    style="background: var(--color-border); cursor: not-allowed;"
                  />
                </div>

                <div class="form-group">
                  <label for="username">Username</label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    required
                    autocomplete="username"
                    minlength="3"
                    maxlength="32"
                    pattern="[a-zA-Z0-9_-]+"
                    title="Letters, numbers, underscores, and hyphens only"
                  />
                </div>

                <div class="form-group">
                  <label for="password">Password</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    required
                    autocomplete="new-password"
                    minlength="8"
                  />
                </div>

                <div class="form-group">
                  <label for="confirmPassword">Confirm Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    required
                    autocomplete="new-password"
                    minlength="8"
                  />
                </div>

                <button type="submit" class="btn" style="width: 100%; margin-top: 8px;">
                  Create Account
                </button>
              </form>
            )}
          </div>
        </body>
      </html>
    </>
  );
}

export function InviteExpiredPage({
  settings = DEFAULT_READER_SETTINGS,
}: {
  settings?: ReaderSettings;
}): JSX.Element {
  const darkClass = settings.dark ? "dark-mode" : "";

  return (
    <>
      {"<!DOCTYPE html>"}
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Invitation Expired - Tome</title>
          <link rel="stylesheet" href="/public/css/base.css" />
          <link rel="icon" type="image/x-icon" href="/public/favicon.ico" />
        </head>
        <body class={darkClass || undefined}>
          <div style="max-width: 400px; margin: 60px auto; padding: 0 16px; text-align: center;">
            <h1 style="border: none; margin: 0 0 16px;">Tome</h1>
            <div class="error">
              <p>This invitation has expired or is invalid.</p>
              <p>Please contact an administrator for a new invitation.</p>
            </div>
          </div>
        </body>
      </html>
    </>
  );
}
