import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

export interface JsWorkflowModule {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  tags?: string[];
  source: "js";
  file_path: string;
  run: (ctx: any) => Promise<void>;
}

const require = createRequire(import.meta.url);

export async function loadJsWorkflow(filePath: string): Promise<JsWorkflowModule> {
  const absolutePath = path.resolve(filePath);

  // Clear from require cache so file changes are picked up on re-load.
  // On macOS, require.cache keys may use the real path (e.g. /private/var/...)
  // while path.resolve returns a symlink path (e.g. /var/...).
  // We delete by both the resolved path and the realpath to handle both cases.
  delete require.cache[absolutePath];
  try {
    delete require.cache[fs.realpathSync(absolutePath)];
  } catch {
    // realpathSync can fail if file hasn't been loaded yet; that's fine
  }

  const mod = require(absolutePath) as {
    name: string;
    description?: string;
    icon?: string;
    tags?: string[];
    run: (ctx: any) => Promise<void>;
  };

  const id = path.basename(absolutePath, ".js");

  return {
    id,
    name: mod.name,
    description: mod.description,
    icon: mod.icon,
    tags: mod.tags,
    source: "js",
    file_path: absolutePath,
    run: mod.run,
  };
}

export async function loadAllJsWorkflows(dir: string): Promise<JsWorkflowModule[]> {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir);
  const jsFiles = entries.filter((entry) => entry.endsWith(".js"));

  const results: JsWorkflowModule[] = [];

  for (const file of jsFiles) {
    const filePath = path.join(dir, file);
    try {
      const workflow = await loadJsWorkflow(filePath);
      results.push(workflow);
    } catch (err) {
      console.error(`[js-loader] Failed to load ${filePath}:`, err);
    }
  }

  return results;
}
