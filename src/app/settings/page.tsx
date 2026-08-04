import { RescanButton } from "@/components/RescanButton";
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
          Text Jellyfin is intended for personal, self-hosted use. Do not expose
          it publicly without authentication.
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
          <h2>Phone uploads</h2>
          <p style={{ color: "var(--muted)", marginBottom: "0.75rem" }}>
            {config.authEnabled
              ? `Enabled — uploads up to ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB are saved under uploads/.`
              : "Disabled — set AUTH_USERNAME and AUTH_PASSWORD in the server environment to enable authenticated uploads."}
          </p>
        </div>
      </div>
    </main>
  );
}
