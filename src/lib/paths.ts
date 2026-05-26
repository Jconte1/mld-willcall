const rawBasePath = process.env.NEXT_PUBLIC_APP_BASE_PATH || "";

export const APP_BASE_PATH =
  rawBasePath && rawBasePath !== "/" ? rawBasePath.replace(/\/+$/, "") : "";

export function appPath(path = "/") {
  const normalized = path.startsWith("/") ? path : `/${path}`;

  if (normalized === "/") {
    return APP_BASE_PATH || "/";
  }

  return `${APP_BASE_PATH}${normalized}`;
}

export function apiPath(path: string) {
  return appPath(path);
}
