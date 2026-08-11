export type HealthIdentity = {
  status: "ok";
  name: "Text Jellyfin";
  version: string;
  serviceMode: boolean;
};

export function createHealthIdentity(
  version: string,
  serviceMode: boolean,
): HealthIdentity {
  return {
    status: "ok",
    name: "Text Jellyfin",
    version,
    serviceMode,
  };
}
