export {};

type UpdateStatus = {
  status: "idle" | "checking" | "available" | "downloading" | "downloaded" | "not-available" | "error" | "unavailable";
  message: string;
  percent?: number;
  version?: string;
};

type DesktopStatus = {
  isDesktop: boolean;
  launchAtStartup: boolean;
  startInTray: boolean;
  platform: string;
  update: UpdateStatus;
  port: number;
  lanUrls: string[];
  authUsername: string;
};

declare global {
  interface Window {
    textJellyfinDesktop?: {
      checkForUpdates: () => Promise<UpdateStatus>;
      deleteServer: () => Promise<{ ok: boolean; message: string }>;
      downloadUpdate: () => Promise<UpdateStatus>;
      getStatus: () => Promise<DesktopStatus>;
      hideToTray: () => Promise<boolean>;
      installUpdate: () => Promise<void>;
      onUpdateStatus: (listener: (status: UpdateStatus) => void) => () => void;
      setLaunchAtStartup: (enabled: boolean) => Promise<boolean>;
      setStartInTray: (enabled: boolean) => Promise<boolean>;
      showWindow: () => Promise<boolean>;
    };
  }
}
