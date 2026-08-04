"use client";

import { useEffect, useState } from "react";

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
  const [update, setUpdate] = useState<UpdateStatus>(initialUpdate);

  useEffect(() => {
    const desktop = window.textJellyfinDesktop;
    if (!desktop) return;

    setIsDesktop(true);
    void desktop.getStatus().then((status) => {
      setLaunchAtStartup(status.launchAtStartup);
      setUpdate(status.update);
    });
    return desktop.onUpdateStatus(setUpdate);
  }, []);

  if (!isDesktop) {
    return (
      <div className="panel">
        <h2>Desktop app</h2>
        <p style={{ color: "var(--muted)", marginBottom: 0 }}>
          Install and open the Windows desktop app to manage startup and application updates here.
        </p>
      </div>
    );
  }

  const changeStartup = async (enabled: boolean) => {
    setLaunchAtStartup(await window.textJellyfinDesktop!.setLaunchAtStartup(enabled));
  };

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
      </div>

      <div className="panel">
        <h2>Application updates</h2>
        <p aria-live="polite" style={{ color: "var(--muted)", marginBottom: "0.75rem" }}>
          {update.message}
        </p>
        <button
          className="button"
          disabled={update.status === "checking" || update.status === "downloading" || update.status === "unavailable"}
          onClick={() => void updateAction()}
          type="button"
        >
          {buttonLabel}
        </button>
      </div>
    </>
  );
}
