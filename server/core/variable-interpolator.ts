import os from "node:os";

export function interpolate(
  template: string,
  context: Record<string, string>
): string {
  return template.replace(/\$\{(\w+)\}/g, (match, varName) => {
    return varName in context ? context[varName] : match;
  });
}

export function expandHome(path: string | undefined): string | undefined {
  if (path === undefined) return undefined;
  if (path.startsWith("~/")) {
    return path.replace("~", os.homedir());
  }
  return path;
}
