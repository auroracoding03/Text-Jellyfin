import { RescanButton } from "@/components/RescanButton";
import { DesktopAppControls } from "@/components/DesktopAppControls";
import { config } from "@/lib/config";
import { getLatestScanRun, getLibraryStats } from "@/lib/catalog/queries";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const stats = getLibraryStats();
  const latest = getLatestScanRun();

  return (
    <main>
      <section className="hero">
        <h1>Settings</h1>
        <p>
          Text Jellyfin is intended for personal, self-hosted use. Sign in with
          Basic Auth (default <code>admin</code> / <code>admin</code>) and keep it on
          your local network.
        </p>
      </section>

      <div className="sidebar" style={{ gridTemplateColumns: "1fr" }}>
        <div className="panel">
          <h2>Paths</h2>
          <dl>
            <div>
              <dt>Library</dt>
              <dd>
                <code>{config.libraryPath}</code>
              </dd>
            </div>
            <div>
              <dt>Data</dt>
              <dd>
                <code>{config.dataPath}</code>
              </dd>
            </div>
            <div>
              <dt>Database</dt>
              <dd>
                <code>{config.dbPath}</code>
              </dd>
            </div>
          </dl>
        </div>

        <div className="panel">
          <h2>Index health</h2>
          <div className="stats">
            <span className="chip">{stats.total} total</span>
            <span className="chip">{stats.ready} ready</span>
            <span className="chip">{stats.warning} warning</span>
            <span className="chip">{stats.needsOcr} needs OCR</span>
            <span className="chip">{stats.failed} failed</span>
          </div>
          {latest ? (
            <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>
              Last scan: {latest.finishedAt || latest.startedAt}
              {latest.message ? ` — ${latest.message}` : ""}
            </p>
          ) : (
            <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>
              No scans yet.
            </p>
          )}
          <RescanButton />
        </div>

        <div className="panel">
          <h2>Login</h2>
          <p style={{ color: "var(--muted)", marginBottom: "0.75rem" }}>
            {config.desktopMode ? (
              <>
                This desktop app is reachable on your LAN. The window signs in automatically;
                phones and other devices use Basic Auth (default <code>admin</code> /{" "}
                <code>admin</code>). See <strong>Network access</strong> below for the URL.
              </>
            ) : (
              <>
                Basic Authentication is always on. Default credentials are{" "}
                <code>admin</code> / <code>admin</code>
                {config.authIsDefault
                  ? " — change AUTH_USERNAME and AUTH_PASSWORD in the server environment when you can."
                  : " — this server is using custom AUTH_USERNAME / AUTH_PASSWORD values."}
              </>
            )}
          </p>
        </div>

        <div className="panel">
          <h2>Phone uploads</h2>
          <p style={{ color: "var(--muted)", marginBottom: "0.75rem" }}>
            Enabled — uploads up to {Math.round(config.maxUploadBytes / 1024 / 1024)} MB are
            saved under uploads/.
          </p>
        </div>

        <DesktopAppControls />
      </div>
    </main>
  );
}
