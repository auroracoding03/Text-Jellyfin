"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/client/api-url";

type UpdateStatus = {
  status: string;
  message: string;
  percent?: number;
  version?: string;
};

const initialUpdate: UpdateStatus = {
  status: "idle",
  message: "Ready to check for updates.",
};

export function DesktopAppControls() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [launchAtStartup, setLaunchAtStartup] = useState(false);
  const [startInTray, setStartInTray] = useState(false);
  const [update, setUpdate] = useState<UpdateStatus>(initialUpdate);
  const [lanUrls, setLanUrls] = useState<string[]>([]);
  const [port, setPort] = useState<number | null>(null);
  const [authUsername, setAuthUsername] = useState("admin");
  const [deleteMessage, setDeleteMessage] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const desktop = window.textJellyfinDesktop;
    if (!desktop) return;

    setIsDesktop(true);
    void desktop.getStatus().then((status) => {
      setLaunchAtStartup(status.launchAtStartup);
      setStartInTray(Boolean(status.startInTray));
      setUpdate(status.update);
      setLanUrls(status.lanUrls || []);
      setPort(status.port);
      setAuthUsername(status.authUsername || "admin");
    });
    return desktop.onUpdateStatus(setUpdate);
  }, []);

  const changeStartup = async (enabled: boolean) => {
    setLaunchAtStartup(await window.textJellyfinDesktop!.setLaunchAtStartup(enabled));
  };

  const changeStartInTray = async (enabled: boolean) => {
    setStartInTray(await window.textJellyfinDesktop!.setStartInTray(enabled));
  };

  const showWindowAtStartup = !startInTray;

  const updateAction = async () => {
    const desktop = window.textJellyfinDesktop!;
    if (update.status === "available") {
      setUpdate(await desktop.downloadUpdate());
      return;
    }
    if (update.status === "downloaded") {
      await desktop.installUpdate();
      return;
    }
    setUpdate(await desktop.checkForUpdates());
  };

  const deleteServer = async () => {
    const confirmed = window.confirm(
      isDesktop
        ? "Delete this Text Jellyfin server and uninstall the app?\n\nYour library files and uploads stay on disk. The catalog, article cache, and application will be removed."
        : "Delete this Text Jellyfin server data?\n\nYour library files and uploads stay on disk. The catalog and article cache will be removed.",
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteMessage("");
    try {
      if (isDesktop && window.textJellyfinDesktop?.deleteServer) {
        await window.textJellyfinDesktop.deleteServer();
        setDeleteMessage("Deleting server and closing the app…");
        return;
      }

      const response = await fetch(apiUrl("/api/server"), { method: "DELETE" });
      const body = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(body.error || "Unable to delete server data.");
      }
      setDeleteMessage(
        body.message ||
          "Server data deleted. Library files were kept. Refresh or rescan when you are ready.",
      );
    } catch (error) {
      setDeleteMessage(
        error instanceof Error ? error.message : "Unable to delete server data.",
      );
    } finally {
      setDeleting(false);
    }
  };

  const buttonLabel =
    update.status === "available"
      ? `Download v${update.version ?? "update"}`
      : update.status === "downloaded"
        ? "Restart & install update"
        : update.status === "downloading"
          ? `Downloading${update.percent === undefined ? "…" : ` ${update.percent}%`}`
          : update.status === "checking"
            ? "Checking…"
            : "Check for updates";

  return (
    <>
      {isDesktop ? (
        <div className="panel">
          <h2>Network access</h2>
          <p style={{ color: "var(--muted)", marginBottom: "0.75rem" }}>
            On your phone (same Wi‑Fi), open one of these addresses and sign in as{" "}
            <code>{authUsername}</code>
            {authUsername === "admin" ? " / admin" : ""}. Allow Text Jellyfin through Windows
            Firewall if the page does not load.
          </p>
          {lanUrls.length ? (
            <ul className="warning-list" style={{ marginBottom: "0.75rem" }}>
              {lanUrls.map((url) => (
                <li key={url}>
                  <code>{url}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: "var(--muted)", marginBottom: "0.75rem" }}>
              No LAN address detected yet. Check that this PC is on Wi‑Fi/Ethernet
              {port ? (
                <>
                  , then try <code>{`http://<PC-IP>:${port}`}</code>
                </>
              ) : null}
              .
            </p>
          )}
          {port ? (
            <p style={{ color: "var(--muted)", marginBottom: 0 }}>
              Listening on port <code>{port}</code> for all network interfaces.
            </p>
          ) : null}
        </div>
      ) : null}

      {isDesktop ? (
        <div className="panel">
          <h2>Startup</h2>
          <label className="desktop-toggle">
            <input
              checked={launchAtStartup}
              onChange={(event) => void changeStartup(event.target.checked)}
              type="checkbox"
            />
            <span>Open Text Jellyfin when I sign in to Windows</span>
          </label>
          <label className="desktop-toggle" style={{ marginTop: "0.85rem" }}>
            <input
              checked={showWindowAtStartup}
              onChange={(event) => void changeStartInTray(!event.target.checked)}
              type="checkbox"
            />
            <span>Open the library window when Text Jellyfin starts</span>
          </label>
          <p style={{ color: "var(--muted)", margin: "0.75rem 0 0", fontSize: "0.9rem" }}>
            Text Jellyfin starts in the system tray with the library server running. Closing or
            minimizing the window does not stop the server — phones can still use the LAN URLs
            above. Use <strong>Quit and stop server</strong> in the tray menu to shut it down.
          </p>
        </div>
      ) : null}

      <div className="panel">
        <h2>Application updates</h2>
        {isDesktop ? (
          <>
            <p aria-live="polite" style={{ color: "var(--muted)", marginBottom: "0.75rem" }}>
              {update.message}
            </p>
            <button
              className="button"
              disabled={
                update.status === "checking" ||
                update.status === "downloading" ||
                update.status === "unavailable"
              }
              onClick={() => void updateAction()}
              type="button"
            >
              {buttonLabel}
            </button>
          </>
        ) : (
          <p style={{ color: "var(--muted)", marginBottom: 0 }}>
            Install and open the Windows desktop app to check for application updates here.
          </p>
        )}
      </div>

      <div className="panel">
        <h2>Delete server</h2>
        <p style={{ color: "var(--muted)", marginBottom: "0.75rem" }}>
          Remove this Text Jellyfin server
          {isDesktop ? " and uninstall the desktop app" : "'s catalog and cache"}. Your
          library folder and uploaded files are not deleted.
        </p>
        {deleteMessage ? (
          <p aria-live="polite" style={{ color: "var(--muted)", marginBottom: "0.75rem" }}>
            {deleteMessage}
          </p>
        ) : null}
        <button
          className="button button-danger"
          disabled={deleting}
          onClick={() => void deleteServer()}
          type="button"
        >
          {deleting ? "Deleting…" : isDesktop ? "Delete server & uninstall" : "Delete server data"}
        </button>
      </div>
    </>
  );
}
