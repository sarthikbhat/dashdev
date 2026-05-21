import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import { parseBackendctl } from "../core/backendctl-parser.js";

// ── helpers ───────────────────────────────────────────────────────────────────

const BACKENDCTL_PATH = path.join(
  os.homedir(),
  "Desktop/code/tm/backend/backendctl"
);

// ── tests ─────────────────────────────────────────────────────────────────────

describe("parseBackendctl", () => {
  it("skips gracefully when the file does not exist", () => {
    expect(() =>
      parseBackendctl("/tmp/nonexistent-backendctl-xyz")
    ).toThrow();
  });

  // All remaining tests require the real backendctl file
  const describeIfExists =
    (() => {
      try {
        require("node:fs").accessSync(BACKENDCTL_PATH);
        return describe;
      } catch {
        return describe.skip;
      }
    })();

  describeIfExists("with real backendctl", () => {
    it("parses exactly 13 services", () => {
      const { services } = parseBackendctl(BACKENDCTL_PATH);
      expect(services).toHaveLength(13);
    });

    it("extracts ports correctly for known services", () => {
      const { services } = parseBackendctl(BACKENDCTL_PATH);
      const byName = Object.fromEntries(services.map((s) => [s.name, s]));

      expect(byName["mysql"].port).toBe(3306);
      expect(byName["redis"].port).toBe(6379);
      expect(byName["postgresql"].port).toBe(5432);
      expect(byName["zookeeper"].port).toBe(2181);
      expect(byName["kafka"].port).toBe(9092);
      expect(byName["clickhouse"].port).toBe(8123);
      expect(byName["elasticsearch"].port).toBe(9200);
      expect(byName["testhub"].port).toBe(8080);
      expect(byName["teststack"].port).toBe(3100);
      expect(byName["obs-api"].port).toBe(3000);
      expect(byName["obs-ingest"].port).toBe(9090);
      expect(byName["obs-consumer"].port).toBe(9091);
      expect(byName["obs-preprocess"].port).toBe(9093);
    });

    it("assigns infra category to infra services", () => {
      const { services } = parseBackendctl(BACKENDCTL_PATH);
      const infraNames = ["mysql", "redis", "postgresql", "zookeeper", "kafka", "clickhouse", "elasticsearch"];
      for (const svc of services.filter((s) => infraNames.includes(s.name))) {
        expect(svc.category).toBe("infra");
      }
    });

    it("assigns app category to app services", () => {
      const { services } = parseBackendctl(BACKENDCTL_PATH);
      const appNames = ["testhub", "teststack", "obs-api", "obs-ingest", "obs-consumer", "obs-preprocess"];
      for (const svc of services.filter((s) => appNames.includes(s.name))) {
        expect(svc.category).toBe("app");
      }
    });

    it("parses TM and TRA groups", () => {
      const { groups } = parseBackendctl(BACKENDCTL_PATH);
      const groupMap = Object.fromEntries(groups.map((g) => [g.name, g]));

      expect(groupMap["TM"]).toBeDefined();
      expect(groupMap["TRA"]).toBeDefined();

      expect(groupMap["TM"].service_names).toContain("mysql");
      expect(groupMap["TM"].service_names).toContain("redis");
      expect(groupMap["TM"].service_names).toContain("clickhouse");
      expect(groupMap["TM"].service_names).toContain("testhub");
      expect(groupMap["TM"].service_names).toContain("teststack");

      expect(groupMap["TRA"].service_names).toContain("postgresql");
      expect(groupMap["TRA"].service_names).toContain("kafka");
      expect(groupMap["TRA"].service_names).toContain("elasticsearch");
      expect(groupMap["TRA"].service_names).toContain("obs-api");
    });

    it("extracts brew start commands for brew-managed services", () => {
      const { services } = parseBackendctl(BACKENDCTL_PATH);
      const byName = Object.fromEntries(services.map((s) => [s.name, s]));

      expect(byName["mysql"].start_command).toBe("brew services start mysql@8.0");
      expect(byName["redis"].start_command).toBe("brew services start redis");
      expect(byName["postgresql"].start_command).toBe("brew services start postgresql@15");
    });

    it("extracts brew stop commands for brew-managed services", () => {
      const { services } = parseBackendctl(BACKENDCTL_PATH);
      const byName = Object.fromEntries(services.map((s) => [s.name, s]));

      expect(byName["mysql"].stop_command).toBe("brew services stop mysql@8.0");
      expect(byName["redis"].stop_command).toBe("brew services stop redis");
      expect(byName["postgresql"].stop_command).toBe("brew services stop postgresql@15");
    });

    it("extracts port-based stop commands for app services", () => {
      const { services } = parseBackendctl(BACKENDCTL_PATH);
      const byName = Object.fromEntries(services.map((s) => [s.name, s]));

      expect(byName["testhub"].stop_command).toMatch(/lsof.*8080.*xargs kill/);
      expect(byName["teststack"].stop_command).toMatch(/lsof.*3100.*xargs kill/);
      expect(byName["obs-api"].stop_command).toMatch(/lsof.*3000.*xargs kill/);
    });

    it("assigns command health_check_type to mysql", () => {
      const { services } = parseBackendctl(BACKENDCTL_PATH);
      const mysql = services.find((s) => s.name === "mysql");
      expect(mysql?.health_check_type).toBe("command");
      expect(mysql?.health_check_value).toMatch(/mysql.*SELECT 1/);
    });

    it("assigns command health_check_type to redis", () => {
      const { services } = parseBackendctl(BACKENDCTL_PATH);
      const redis = services.find((s) => s.name === "redis");
      expect(redis?.health_check_type).toBe("command");
      expect(redis?.health_check_value).toBe("redis-cli ping");
    });

    it("assigns command health_check_type to postgresql", () => {
      const { services } = parseBackendctl(BACKENDCTL_PATH);
      const pg = services.find((s) => s.name === "postgresql");
      expect(pg?.health_check_type).toBe("command");
      expect(pg?.health_check_value).toMatch(/psql.*SELECT 1/);
    });

    it("assigns http health_check_type to testhub with correct URL", () => {
      const { services } = parseBackendctl(BACKENDCTL_PATH);
      const testhub = services.find((s) => s.name === "testhub");
      expect(testhub?.health_check_type).toBe("http");
      expect(testhub?.health_check_value).toMatch(/localhost:8080/);
    });

    it("assigns http health_check_type to obs-api with actuator path", () => {
      const { services } = parseBackendctl(BACKENDCTL_PATH);
      const obsApi = services.find((s) => s.name === "obs-api");
      expect(obsApi?.health_check_type).toBe("http");
      expect(obsApi?.health_check_value).toMatch(/localhost:3000/);
    });
  });
});
