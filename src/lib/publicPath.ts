const rawPublicBasePath = process.env.NEXT_PUBLIC_PUBLIC_BASE_PATH || "";

export const publicBasePath =
  rawPublicBasePath && rawPublicBasePath !== "/"
    ? rawPublicBasePath.replace(/\/+$/, "")
    : "";

export function withPublicBasePath(path: string) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  return publicBasePath ? `${publicBasePath}${cleanPath}` : cleanPath;
}