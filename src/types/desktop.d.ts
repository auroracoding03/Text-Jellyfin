export {};

type UpdateStatus = {
  status: "idle" | "checking" | "available" | "downloading" | "downloaded" | "not-available" | "error" | "unavailable";
  message: string;
  percent?: number;
  version?: string;
};

declare global {
  interface Window {
    textJellyfinDesktop?: {
      checkForUpdates: () => Promise<UpdateStatus>;
      downloadUpdate: () => Promise<UpdateStatus>;
      getStatus: () => Promise<{
        isDesktop: boolean;
        launchAtStartup: boolean;
        platform: string;
        update: UpdateStatus;
      }>;
      installUpdate: () => Promise<void>;
      onUpdateStatus: (listener: (status: UpdateStatus) => void) => () => void;
      setLaunchAtStartup: (enabled: boolean) => Promise<boolean>;
    };
  }
}
