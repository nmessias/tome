/**
 * Settings page template — Phase 1: registry-driven.
 * Source toggles list every registered source; credentials forms render from
 * each enabled source's credentialFields (ADR-0001).
 */
import { Layout } from "../layout";
import { Alert, SectionTitle, formatBytes } from "../components";
import type { CacheStats } from "../../services/cache";
import type { ReaderSettings } from "../../config";
import type { Source } from "../../services/source-registry";
import { DEFAULT_READER_SETTINGS, AUTH_ENABLED } from "../../config";

export interface Invitation {
  id: string;
  email: string;
  token: string;
  expiresAt: number;
  inviteUrl: string;
}

export function SettingsPage({
  message,
  isError,
  settings = DEFAULT_READER_SETTINGS,
  stats,
  isAdmin = false,
  invitations = [],
  allSources = [],
  enabledSources = [],
}: {
  message?: string;
  isError?: boolean;
  settings?: ReaderSettings;
  stats?: CacheStats;
  isAdmin?: boolean;
  invitations?: Invitation[];
  allSources?: Source[];
  enabledSources?: Source[];
}): JSX.Element {
  const totalSize = stats ? stats.totalSize + stats.imageSize : 0;
  const canManageCache = isAdmin || !AUTH_ENABLED;
  const enabledNames = new Set(enabledSources.map((s) => s.name));
  const credentialSources = enabledSources.filter((s) => s.capabilities.credentials);

  return (
    <Layout title="Settings" settings={settings} currentPath="/settings" sources={enabledSources}>
      <h1>Settings</h1>
      {message && <Alert message={message} isError={isError} />}

      <SectionTitle>Reading Sources</SectionTitle>
      <div class="card">
        {allSources.map((s, i) => {
          const enabled = enabledNames.has(s.name);
          return (
            <div
              style={
                i > 0
                  ? "border-top: 1px solid #ccc; padding-top: 16px; margin-top: 16px;"
                  : undefined
              }
            >
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <strong safe>{s.displayName}</strong>
                  {s.description && (
                    <div style="font-size: 12px;" safe>{s.description}</div>
                  )}
                </div>
                <form method="POST" action="/settings/sources" style="margin: 0;">
                  <input type="hidden" name="source" value={s.name} />
                  <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
                  <button type="submit" class="btn btn-small">
                    {enabled ? "Disable" : "Enable"}
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      <SectionTitle>Display</SectionTitle>
      <div class="card">
        {settings.isKindle ? (
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>Dark Mode</span>
            <form method="POST" action="/settings/theme" style="margin: 0;">
              <input type="hidden" name="theme" value={settings.dark ? "light" : "dark"} />
              <button type="submit" class="btn btn-small">
                {settings.dark ? "Turn Off" : "Turn On"}
              </button>
            </form>
          </div>
        ) : (
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>Theme</span>
            <form method="POST" action="/settings/theme" style="margin: 0; display: flex; gap: 8px;">
              <button
                type="submit"
                name="theme"
                value="light"
                class={"btn btn-small" + ((settings.theme || 'light') === 'light' ? "" : " btn-outline")}
              >
                Light
              </button>
              <button
                type="submit"
                name="theme"
                value="dark"
                class={"btn btn-small" + (settings.theme === 'dark' ? "" : " btn-outline")}
              >
                Dark
              </button>
              <button
                type="submit"
                name="theme"
                value="sepia"
                class={"btn btn-small" + (settings.theme === 'sepia' ? "" : " btn-outline")}
              >
                Sepia
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Credentials forms — one per enabled source with capabilities.credentials */}
      {credentialSources.map((s) => (
        <>
          <SectionTitle>{`${s.displayName} Session`}</SectionTitle>

          {s.autoLogin?.enabled ? (
            <div class="card" style="margin-bottom: 16px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="color: #0a0; font-size: 18px;">✓</span>
                <strong>Auto-login configured</strong>
              </div>
              <p style="font-size: 14px; margin: 0;">
                {s.displayName} credentials are set via environment variables. The app will
                automatically log in when your session expires.
              </p>
              <div class="form-actions" style="margin-top: 12px;">
                <form method="POST" action={`/settings/sources/${s.name}/auto-login`} style="margin: 0;">
                  <button type="submit" class="btn">Refresh Session Now</button>
                </form>
              </div>
            </div>
          ) : (
            <p style="font-size: 14px;">
              Enter your {s.displayName} session credentials to access your account features.
              Find these in your browser's developer tools (F12 → Application → Cookies).
            </p>
          )}

          <form method="POST" action={`/settings/sources/${s.name}/credentials`}>
            {(s.credentialFields || []).map((field) => (
              <div class="form-group">
                <label for={field.name} safe>{field.label}</label>
                {field.textarea ? (
                  <textarea
                    name={field.name}
                    id={field.name}
                    placeholder={field.placeholder}
                    required={field.required}
                  ></textarea>
                ) : (
                  <input
                    type="text"
                    name={field.name}
                    id={field.name}
                    placeholder={field.placeholder}
                    required={field.required}
                  />
                )}
                {field.hint && <div class="hint" safe>{field.hint}</div>}
              </div>
            ))}

            <div class="form-actions">
              <button type="submit" class="btn">Save Credentials</button>
              <a href={`/settings/sources/${s.name}/credentials/clear`} class="btn btn-outline">Clear</a>
            </div>
          </form>
        </>
      ))}

      {stats && (
        <>
          <SectionTitle>Cache</SectionTitle>
          <div class="card">
            <form method="post" action="/settings/cache/read-ahead" style="margin-bottom: 12px;">
              <label for="read-ahead-depth">Chapters to prepare ahead on this device</label>
              <select id="read-ahead-depth" name="depth" style="min-height: 40px;">
                <option value="" selected={settings.readAheadDepth === undefined}>Server default</option>
                {Array.from({ length: 11 }, (_, depth) => (
                  <option value={String(depth)} selected={settings.readAheadDepth === depth}>{depth}</option>
                ))}
              </select>
              <button type="submit" class="btn btn-outline btn-small">Save</button>
            </form>
            <div style="margin-bottom: 12px;">
              <div><strong>Text entries:</strong> <span safe>{stats.totalEntries}</span> (<span safe>{formatBytes(stats.totalSize)}</span>)</div>
              <div><strong>Images:</strong> <span safe>{stats.imageCount}</span> (<span safe>{formatBytes(stats.imageSize)}</span>)</div>
              <div><strong>Total:</strong> <span safe>{formatBytes(totalSize)}</span></div>
              {stats.databaseSize !== undefined && <div><strong>Database on disk:</strong> <span safe>{formatBytes(stats.databaseSize)}</span></div>}
              {stats.volumeAvailable !== undefined && <div><strong>Volume available:</strong> <span safe>{formatBytes(stats.volumeAvailable)}</span></div>}
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
                        {canManageCache && (
                          <form method="post" action={`/settings/cache/clear/${t.type}`} onsubmit="return confirm('Clear this cache type?')">
                            <button type="submit" class="btn btn-outline btn-small">Clear</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {stats.chapterBooks && stats.chapterBooks.length > 0 && (
              <>
                <h3>Cached chapters by novel</h3>
                <p>Sizes include fresh and retained copies. Older entries without novel metadata are included in the totals above.</p>
                <table style="margin-bottom: 12px;">
                  <thead><tr><th>Novel</th><th>Chapters</th><th>Text size</th><th></th></tr></thead>
                  <tbody>
                    {stats.chapterBooks.map((book) => (
                      <tr>
                        <td><span safe>{book.title}</span>{book.lastAccessedAt && <small> (read {new Date(book.lastAccessedAt).toLocaleDateString()})</small>}</td>
                        <td safe>{book.chapterCount}</td>
                        <td safe>{formatBytes(book.size)}</td>
                        <td>
                          <form method="post" action="/settings/cache/novel/clear" onsubmit="return confirm('Clear cached chapters for this novel?')">
                            <input type="hidden" name="source" value={book.source} />
                            <input type="hidden" name="fictionRef" value={book.fictionRef} />
                            <button type="submit" class="btn btn-outline btn-small">Clear</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <div class="form-actions">
              {canManageCache && stats.expiredCount > 0 && (
                <form method="post" action="/settings/cache/clear/expired" onsubmit="return confirm('Clear expired cache entries?')">
                  <button type="submit" class="btn btn-outline btn-small">Clear Expired ({stats.expiredCount})</button>
                </form>
              )}
              {canManageCache && stats.imageCount > 0 && (
                <form method="post" action="/settings/cache/clear/images" onsubmit="return confirm('Clear cached images?')">
                  <button type="submit" class="btn btn-outline btn-small">Clear Images</button>
                </form>
              )}
              {canManageCache && (
                <form method="post" action="/settings/cache/clear/all" onsubmit="return confirm('Clear all cached content?')">
                  <button type="submit" class="btn btn-small">Clear All</button>
                </form>
              )}
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

      {/* Invite Users - Admin Only */}
      {isAdmin && (
        <>
          <SectionTitle>Invite Users</SectionTitle>

          {/* Create Invitation Form */}
          <div class="card">
            <form method="POST" action="/settings/invitations">
              <div class="form-group">
                <label for="email">Email</label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div class="form-actions">
                <button type="submit" class="btn">Create Invitation</button>
              </div>
            </form>
          </div>

          {/* Pending Invitations List */}
          {invitations.length > 0 && (
            <div class="card">
              <div style="margin-bottom: 12px; font-weight: bold;">
                Pending Invitations ({invitations.length})
              </div>
              {invitations.map((inv) => {
                const expiresDate = new Date(inv.expiresAt * 1000);

                return (
                  <div style="border-top: 1px solid #000; padding-top: 12px; margin-top: 12px;">
                    <div style="font-weight: bold;" safe>{inv.email}</div>
                    <div style="font-size: 12px; margin-top: 4px;">
                      Expires: <span safe>{expiresDate.toLocaleDateString()}</span>
                    </div>

                    <div class="form-group" style="margin-top: 8px; margin-bottom: 8px;">
                      <label style="font-size: 12px;">Invite Link:</label>
                      <input
                        type="text"
                        readonly
                        value={inv.inviteUrl as any}
                        style="font-size: 12px; padding: 8px;"
                      />
                    </div>

                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                      <img
                        src={`/api/invitations/qr/${inv.token}`}
                        alt="QR Code"
                        style="width: 80px; height: 80px; border: 1px solid #000;"
                      />
                      <form method="POST" action={`/settings/invitations/revoke/${inv.id}`} style="margin: 0;">
                        <button type="submit" class="btn btn-outline btn-small">Revoke</button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {invitations.length === 0 && (
            <div class="card">
              <div style="font-style: italic;">No pending invitations.</div>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
