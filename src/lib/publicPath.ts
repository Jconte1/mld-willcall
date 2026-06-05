export const publicBasePath = "";

export function withPublicBasePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}
