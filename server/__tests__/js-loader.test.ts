import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { loadJsWorkflow, loadAllJsWorkflows } from "../core/js-loader.js";

const TEST_MODULE_CONTENT = `
module.exports = {
  name: "JS Workflow",
  description: "A test JS workflow",
  icon: "gear",
  tags: ["test"],
  async run({ exec, log }) {
    await exec("echo hello");
  },
};
`;

let tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join("/tmp", "js-loader-test-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

describe("loadJsWorkflow", () => {
  it("loads a CommonJS module and returns a JsWorkflowModule", async () => {
    const dir = makeTmpDir();
    const filePath = path.join(dir, "test-js.js");
    fs.writeFileSync(filePath, TEST_MODULE_CONTENT);

    const workflow = await loadJsWorkflow(filePath);

    expect(workflow.id).toBe("test-js");
    expect(workflow.name).toBe("JS Workflow");
    expect(workflow.description).toBe("A test JS workflow");
    expect(workflow.icon).toBe("gear");
    expect(workflow.tags).toEqual(["test"]);
    expect(workflow.source).toBe("js");
    expect(workflow.file_path).toBe(filePath);
    expect(typeof workflow.run).toBe("function");
  });

  it("derives id from filename without extension", async () => {
    const dir = makeTmpDir();
    const filePath = path.join(dir, "my-cool-workflow.js");
    fs.writeFileSync(filePath, TEST_MODULE_CONTENT);

    const workflow = await loadJsWorkflow(filePath);

    expect(workflow.id).toBe("my-cool-workflow");
  });

  it("returns a callable run function", async () => {
    const dir = makeTmpDir();
    const filePath = path.join(dir, "test-js.js");
    fs.writeFileSync(filePath, `
module.exports = {
  name: "Runnable",
  async run({ log }) {
    log("ran");
  },
};
`);

    const workflow = await loadJsWorkflow(filePath);
    const logs: string[] = [];
    await workflow.run({ log: (msg: string) => logs.push(msg), exec: async () => {} });

    expect(logs).toEqual(["ran"]);
  });

  it("picks up file changes by clearing require cache", async () => {
    const dir = makeTmpDir();
    const filePath = path.join(dir, "changing.js");

    fs.writeFileSync(filePath, `module.exports = { name: "Version 1", run: async () => {} };`);
    const first = await loadJsWorkflow(filePath);
    expect(first.name).toBe("Version 1");

    fs.writeFileSync(filePath, `module.exports = { name: "Version 2", run: async () => {} };`);
    const second = await loadJsWorkflow(filePath);
    expect(second.name).toBe("Version 2");
  });
});

describe("loadAllJsWorkflows", () => {
  it("loads all .js files from a directory", async () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, "workflow-a.js"), TEST_MODULE_CONTENT);
    fs.writeFileSync(path.join(dir, "workflow-b.js"), TEST_MODULE_CONTENT);

    const workflows = await loadAllJsWorkflows(dir);

    expect(workflows).toHaveLength(2);
    const ids = workflows.map((w) => w.id).sort();
    expect(ids).toEqual(["workflow-a", "workflow-b"]);
  });

  it("skips non-.js files", async () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, "workflow.js"), TEST_MODULE_CONTENT);
    fs.writeFileSync(path.join(dir, "workflow.yaml"), "name: yaml-workflow");
    fs.writeFileSync(path.join(dir, "readme.txt"), "ignore me");

    const workflows = await loadAllJsWorkflows(dir);

    expect(workflows).toHaveLength(1);
    expect(workflows[0].id).toBe("workflow");
  });

  it("returns empty array for non-existent directory", async () => {
    const workflows = await loadAllJsWorkflows("/tmp/this-directory-does-not-exist-devdash");
    expect(workflows).toEqual([]);
  });

  it("returns empty array for empty directory", async () => {
    const dir = makeTmpDir();
    const workflows = await loadAllJsWorkflows(dir);
    expect(workflows).toEqual([]);
  });

  it("skips files that fail to load and continues", async () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, "good.js"), TEST_MODULE_CONTENT);
    fs.writeFileSync(path.join(dir, "bad.js"), "this is not valid javascript }{{{");

    const workflows = await loadAllJsWorkflows(dir);

    expect(workflows).toHaveLength(1);
    expect(workflows[0].id).toBe("good");
  });
});
