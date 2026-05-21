import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadYamlWorkflow, loadAllYamlWorkflows } from "../core/yaml-loader.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "devdash-yaml-test-"));
}

function writeFile(dir: string, name: string, content: string): string {
  const p = path.join(dir, name);
  fs.writeFileSync(p, content, "utf8");
  return p;
}

const VALID_YAML = `
name: My Workflow
description: Does something useful
icon: rocket
tags:
  - backend
  - deploy
env:
  NODE_ENV: production
params:
  - name: env
    label: Environment
    type: select
    required: true
    default: staging
    options:
      - staging
      - production
steps:
  - name: Build
    command: npm run build
    type: run-and-done
    timeout: 120
  - name: Deploy
    command: ./deploy.sh
    type: long-running
    workdir: /tmp
    on_failure: continue
`;

const MINIMAL_YAML = `
name: Minimal
steps:
  - name: Hello
    command: echo hello
`;

// ── cleanup ───────────────────────────────────────────────────────────────────

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── loadYamlWorkflow ──────────────────────────────────────────────────────────

describe("loadYamlWorkflow", () => {
  it("parses a valid YAML file and returns all top-level fields", () => {
    const dir = makeTmpDir();
    tmpDirs.push(dir);
    const filePath = writeFile(dir, "my-workflow.yml", VALID_YAML);

    const wf = loadYamlWorkflow(filePath);

    expect(wf.name).toBe("My Workflow");
    expect(wf.description).toBe("Does something useful");
    expect(wf.icon).toBe("rocket");
    expect(wf.tags).toEqual(["backend", "deploy"]);
    expect(wf.env).toEqual({ NODE_ENV: "production" });
  });

  it("derives id from the filename without extension (.yml)", () => {
    const dir = makeTmpDir();
    tmpDirs.push(dir);
    const filePath = writeFile(dir, "my-workflow.yml", VALID_YAML);

    const wf = loadYamlWorkflow(filePath);

    expect(wf.id).toBe("my-workflow");
  });

  it("derives id from the filename without extension (.yaml)", () => {
    const dir = makeTmpDir();
    tmpDirs.push(dir);
    const filePath = writeFile(dir, "deploy-prod.yaml", VALID_YAML);

    const wf = loadYamlWorkflow(filePath);

    expect(wf.id).toBe("deploy-prod");
  });

  it("sets source to 'yaml'", () => {
    const dir = makeTmpDir();
    tmpDirs.push(dir);
    const filePath = writeFile(dir, "my-workflow.yml", VALID_YAML);

    const wf = loadYamlWorkflow(filePath);

    expect(wf.source).toBe("yaml");
  });

  it("sets file_path to the resolved absolute path", () => {
    const dir = makeTmpDir();
    tmpDirs.push(dir);
    const filePath = writeFile(dir, "my-workflow.yml", VALID_YAML);

    const wf = loadYamlWorkflow(filePath);

    expect(wf.file_path).toBe(path.resolve(filePath));
  });

  it("parses steps with correct fields and types", () => {
    const dir = makeTmpDir();
    tmpDirs.push(dir);
    const filePath = writeFile(dir, "my-workflow.yml", VALID_YAML);

    const wf = loadYamlWorkflow(filePath);

    expect(wf.steps).toHaveLength(2);

    const [build, deploy] = wf.steps;
    expect(build.name).toBe("Build");
    expect(build.command).toBe("npm run build");
    expect(build.type).toBe("run-and-done");
    expect(build.timeout).toBe(120);

    expect(deploy.name).toBe("Deploy");
    expect(deploy.command).toBe("./deploy.sh");
    expect(deploy.type).toBe("long-running");
    expect(deploy.workdir).toBe("/tmp");
    expect(deploy.on_failure).toBe("continue");
  });

  it("defaults step type to 'run-and-done' when not specified", () => {
    const dir = makeTmpDir();
    tmpDirs.push(dir);
    const filePath = writeFile(dir, "minimal.yml", MINIMAL_YAML);

    const wf = loadYamlWorkflow(filePath);

    expect(wf.steps[0].type).toBe("run-and-done");
  });

  it("parses params correctly", () => {
    const dir = makeTmpDir();
    tmpDirs.push(dir);
    const filePath = writeFile(dir, "my-workflow.yml", VALID_YAML);

    const wf = loadYamlWorkflow(filePath);

    expect(wf.params).toHaveLength(1);
    const param = wf.params![0];
    expect(param.name).toBe("env");
    expect(param.label).toBe("Environment");
    expect(param.type).toBe("select");
    expect(param.required).toBe(true);
    expect(param.default).toBe("staging");
    expect(param.options).toEqual(["staging", "production"]);
  });

  it("returns undefined params when not present in YAML", () => {
    const dir = makeTmpDir();
    tmpDirs.push(dir);
    const filePath = writeFile(dir, "minimal.yml", MINIMAL_YAML);

    const wf = loadYamlWorkflow(filePath);

    expect(wf.params).toBeUndefined();
  });

  it("throws when the file does not exist", () => {
    expect(() =>
      loadYamlWorkflow("/tmp/nonexistent-devdash-file.yml")
    ).toThrow();
  });

  it("throws when the YAML is missing the required 'name' field", () => {
    const dir = makeTmpDir();
    tmpDirs.push(dir);
    const filePath = writeFile(dir, "bad.yml", "steps:\n  - name: x\n    command: y\n");

    expect(() => loadYamlWorkflow(filePath)).toThrow(/name/i);
  });

  it("throws when steps is missing or empty", () => {
    const dir = makeTmpDir();
    tmpDirs.push(dir);
    const filePath = writeFile(dir, "bad.yml", "name: No Steps\n");

    expect(() => loadYamlWorkflow(filePath)).toThrow(/steps/i);
  });
});

// ── loadAllYamlWorkflows ──────────────────────────────────────────────────────

describe("loadAllYamlWorkflows", () => {
  it("loads all .yml and .yaml files from a directory", () => {
    const dir = makeTmpDir();
    tmpDirs.push(dir);
    writeFile(dir, "alpha.yml", VALID_YAML);
    writeFile(dir, "beta.yaml", MINIMAL_YAML);

    const workflows = loadAllYamlWorkflows(dir);

    expect(workflows).toHaveLength(2);
    const ids = workflows.map((w) => w.id).sort();
    expect(ids).toEqual(["alpha", "beta"]);
  });

  it("ignores non-YAML files (.js, .ts, .json, etc.)", () => {
    const dir = makeTmpDir();
    tmpDirs.push(dir);
    writeFile(dir, "workflow.yml", MINIMAL_YAML);
    writeFile(dir, "script.js", "module.exports = {};");
    writeFile(dir, "data.json", "{}");
    writeFile(dir, "readme.md", "# readme");

    const workflows = loadAllYamlWorkflows(dir);

    expect(workflows).toHaveLength(1);
    expect(workflows[0].id).toBe("workflow");
  });

  it("returns an empty array for a non-existent directory", () => {
    const workflows = loadAllYamlWorkflows("/tmp/devdash-nonexistent-dir-xyz");

    expect(workflows).toEqual([]);
  });

  it("returns an empty array for an empty directory", () => {
    const dir = makeTmpDir();
    tmpDirs.push(dir);

    const workflows = loadAllYamlWorkflows(dir);

    expect(workflows).toEqual([]);
  });

  it("continues loading remaining files when one file has invalid YAML", () => {
    const dir = makeTmpDir();
    tmpDirs.push(dir);
    writeFile(dir, "good.yml", MINIMAL_YAML);
    writeFile(dir, "bad.yml", "name: Bad\n  invalid: yaml: : :");

    const workflows = loadAllYamlWorkflows(dir);

    // Only the good one should come back
    expect(workflows).toHaveLength(1);
    expect(workflows[0].id).toBe("good");
  });

  it("each loaded workflow has source='yaml' and file_path set", () => {
    const dir = makeTmpDir();
    tmpDirs.push(dir);
    writeFile(dir, "alpha.yml", MINIMAL_YAML);

    const [wf] = loadAllYamlWorkflows(dir);

    expect(wf.source).toBe("yaml");
    expect(wf.file_path).toBe(path.join(dir, "alpha.yml"));
  });
});
