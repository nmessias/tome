/**
 * Login page template
 */
import { Layout } from "../layout";
import type { ReaderSettings } from "../../config";
import { DEFAULT_READER_SETTINGS } from "../../config";

export function LoginPage({
  settings = DEFAULT_READER_SETTINGS,
  error,
}: {
  settings?: ReaderSettings;
  error?: string;
}): JSX.Element {
  return (
    <Layout title="Login" settings={settings}>
      <div style="max-width: 400px; margin: 40px auto; padding: 0 16px;">
        <h1>Login</h1>
        <p>Sign in to access Tome.</p>
        
        {error && (
          <div class="error" style="margin-bottom: 16px;" safe>
            {error}
          </div>
        )}
        
        <form method="POST" action="/login">
          <div style="margin-bottom: 16px;">
            <label for="username" style="display: block; margin-bottom: 4px; font-weight: bold;">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              required
              autocomplete="username"
              style="width: 100%; padding: 8px; font-size: 16px; border: 1px solid #ccc; border-radius: 4px;"
            />
          </div>
          
          <div style="margin-bottom: 24px;">
            <label for="password" style="display: block; margin-bottom: 4px; font-weight: bold;">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              autocomplete="current-password"
              style="width: 100%; padding: 8px; font-size: 16px; border: 1px solid #ccc; border-radius: 4px;"
            />
          </div>
          
          <button
            type="submit"
            class="btn"
            style="width: 100%; padding: 12px; font-size: 16px;"
          >
            Sign In
          </button>
        </form>
      </div>
    </Layout>
  );
}
