/**
 * Settings page template
 * Combines cookie setup, cache management, dark mode toggle, and logout
 */
import { Layout } from "../layout";
import { Alert, SectionTitle, formatBytes } from "../components";
import type { CacheStats } from "../../services/cache";
import type { ReaderSettings } from "../../config";
import { DEFAULT_READER_SETTINGS, AUTH_ENABLED } from "../../config";

export function SettingsPage({
  message,
  isError,
  settings = DEFAULT_READER_SETTINGS,
  stats,
}: {
  message?: string;
  isError?: boolean;
  settings?: ReaderSettings;
  stats?: CacheStats;
}): JSX.Element {
  const totalSize = stats ? stats.totalSize + stats.imageSize : 0;

  return (
    <Layout title="Settings" settings={settings} currentPath="/settings">
      <h1>Settings</h1>
      {message && <Alert message={message} isError={isError} />}

      {/* Dark Mode Toggle */}
      <SectionTitle>Display</SectionTitle>
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>Dark Mode</span>
          <form method="POST" action="/settings/theme" style="margin: 0;">
            <input type="hidden" name="dark" value={settings.dark ? "0" : "1"} />
            <button type="submit" class="btn btn-small">
              {settings.dark ? "Turn Off" : "Turn On"}
            </button>
          </form>
        </div>
      </div>

      {/* Session Cookies */}
      <SectionTitle>Royal Road Session</SectionTitle>
      <p style="font-size: 14px;">
        Enter your Royal Road session cookies to access your follows and reading history.
        Find these in your browser's developer tools (F12 → Application → Cookies).
      </p>
      <form method="POST" action="/settings/cookies">
        <div class="form-group">
          <label for="identity">.AspNetCore.Identity.Application</label>
          <textarea
            name="identity"
            id="identity"
            placeholder="Paste your auth cookie value here"
          ></textarea>
        </div>

        <div class="form-group">
          <label for="cfclearance">cf_clearance (optional)</label>
          <textarea
            name="cfclearance"
            id="cfclearance"
            placeholder="Paste if you get Cloudflare errors"
          ></textarea>
          <div class="hint">Only needed if you encounter Cloudflare blocking issues.</div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn">Save Cookies</button>
          <a href="/settings/cookies/clear" class="btn btn-outline">Clear Cookies</a>
        </div>
      </form>

      {/* Cache Management */}
      {stats && (
        <>
          <SectionTitle>Cache</SectionTitle>
          <div class="card">
            <div style="margin-bottom: 12px;">
              <div><strong>Text entries:</strong> <span safe>{stats.totalEntries}</span> (<span safe>{formatBytes(stats.totalSize)}</span>)</div>
              <div><strong>Images:</strong> <span safe>{stats.imageCount}</span> (<span safe>{formatBytes(stats.imageSize)}</span>)</div>
              <div><strong>Total:</strong> <span safe>{formatBytes(totalSize)}</span></div>
            </div>

            {stats.byType.length > 0 && (
              <table style="margin-bottom: 12px;">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th style="text-align: right;">Count</th>
                    <th style="text-align: right;">Size</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byType.map((t) => (
                    <tr>
                      <td safe>{t.type}</td>
                      <td style="text-align: right;">{t.count}</td>
                      <td style="text-align: right;"><span safe>{formatBytes(t.size)}</span></td>
                      <td style="text-align: right;">
                        <a href={`/settings/cache/clear/${t.type}`} class="btn btn-outline btn-small">
                          Clear
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div class="form-actions">
              {stats.expiredCount > 0 && (
                <a href="/settings/cache/clear/expired" class="btn btn-outline btn-small">
                  Clear Expired ({stats.expiredCount})
                </a>
              )}
              {stats.imageCount > 0 && (
                <a href="/settings/cache/clear/images" class="btn btn-outline btn-small">
                  Clear Images
                </a>
              )}
              <a href="/settings/cache/clear/all" class="btn btn-small">
                Clear All
              </a>
            </div>
          </div>
        </>
      )}

      {/* Logout */}
      {AUTH_ENABLED && (
        <>
          <SectionTitle>Account</SectionTitle>
          <form method="POST" action="/logout">
            <button type="submit" class="btn btn-outline">Logout</button>
          </form>
        </>
      )}
    </Layout>
  );
}
