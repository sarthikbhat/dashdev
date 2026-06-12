import { Router } from "express";
import type { Database } from "../core/db.js";

const GH_API = "https://api.github.com";

async function ghFetch(path: string, token: string) {
  const res = await fetch(`${GH_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  return res.json();
}

function mapPR(pr: any, repo: string) {
  return {
    repo,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    draft: pr.draft,
    user: pr.user.login,
    user_avatar: pr.user.avatar_url,
    created_at: pr.created_at,
    updated_at: pr.updated_at,
    head_branch: pr.head.ref,
    head_sha: pr.head.sha,
    base_branch: pr.base.ref,
    requested_reviewers: (pr.requested_reviewers ?? []).map((r: any) => r.login),
    labels: (pr.labels ?? []).map((l: any) => ({ name: l.name, color: l.color })),
    html_url: pr.html_url,
    additions: pr.additions,
    deletions: pr.deletions,
    changed_files: pr.changed_files,
    mergeable_state: pr.mergeable_state,
    reviews: [] as any[],
    checks: null as any,
  };
}

export function githubRouter(db: Database): Router {
  const router = Router();

  // ── Settings: token + tracked repos ──

  router.get("/settings", (_req, res) => {
    const token = db.getEncryptedSetting("github_token");
    const repos = db.getSetting("github_repos");
    res.json({
      hasToken: !!token,
      tokenPreview: token ? `ghp_${"*".repeat(16)}...${token.slice(-4)}` : null,
      repos: repos ? JSON.parse(repos) : [],
    });
  });

  router.put("/settings/token", (req, res) => {
    const { token } = req.body;
    if (!token || typeof token !== "string") {
      res.status(400).json({ error: "Token is required" });
      return;
    }
    db.setEncryptedSetting("github_token", token.trim());
    db.deleteSetting("github_username");
    res.json({ ok: true });
  });

  router.delete("/settings/token", (_req, res) => {
    db.deleteSetting("github_token");
    db.deleteSetting("github_username");
    res.json({ ok: true });
  });

  router.put("/settings/repos", (req, res) => {
    const { repos } = req.body;
    if (!Array.isArray(repos)) {
      res.status(400).json({ error: "repos must be an array of owner/repo strings" });
      return;
    }
    db.setSetting("github_repos", JSON.stringify(repos));
    res.json({ ok: true });
  });

  // ── Current user ──

  router.get("/user", async (_req, res) => {
    const token = db.getEncryptedSetting("github_token");
    if (!token) { res.status(401).json({ error: "No GitHub token configured" }); return; }
    try {
      const cached = db.getSetting("github_username");
      if (cached) { res.json({ login: cached }); return; }
      const user = await ghFetch("/user", token) as any;
      db.setSetting("github_username", user.login);
      res.json({ login: user.login });
    } catch (e: any) {
      res.status(502).json({ error: e.message });
    }
  });

  // ── Fetch user's repos for picker ──

  router.get("/repos", async (_req, res) => {
    const token = db.getEncryptedSetting("github_token");
    if (!token) { res.status(401).json({ error: "No GitHub token configured" }); return; }
    try {
      const data = await ghFetch("/user/repos?sort=pushed&per_page=50&affiliation=owner,collaborator,organization_member", token);
      const repos = (data as any[]).map((r: any) => ({
        full_name: r.full_name,
        name: r.name,
        owner: r.owner.login,
        private: r.private,
        default_branch: r.default_branch,
        updated_at: r.pushed_at,
      }));
      res.json(repos);
    } catch (e: any) {
      res.status(502).json({ error: e.message });
    }
  });

  // ── Aggregated CI/CD data for tracked repos ──

  router.get("/status", async (_req, res) => {
    const token = db.getEncryptedSetting("github_token");
    if (!token) { res.status(401).json({ error: "No GitHub token configured" }); return; }

    const reposRaw = db.getSetting("github_repos");
    const repos: string[] = reposRaw ? JSON.parse(reposRaw) : [];
    if (repos.length === 0) { res.json({ currentUser: null, repos: [], myPRs: [], reviewRequests: [] }); return; }

    // Resolve current user
    let currentUser = db.getSetting("github_username");
    if (!currentUser) {
      try {
        const u = await ghFetch("/user", token) as any;
        currentUser = u.login;
        db.setSetting("github_username", currentUser!);
      } catch { /* proceed without user filtering */ }
    }

    try {
      const repoResults = await Promise.all(repos.map(async (repo) => {
        const [prs, actions, deploys] = await Promise.all([
          ghFetch(`/repos/${repo}/pulls?state=open&per_page=100`, token).catch(() => []),
          ghFetch(`/repos/${repo}/actions/runs?per_page=10`, token).catch(() => ({ workflow_runs: [] })),
          ghFetch(`/repos/${repo}/deployments?per_page=5`, token).catch(() => []),
        ]);

        const pullRequests = (prs as any[]).map((pr: any) => mapPR(pr, repo));

        const ciRuns = ((actions as any).workflow_runs ?? []).map((r: any) => ({
          id: r.id,
          name: r.name,
          status: r.status,
          conclusion: r.conclusion,
          branch: r.head_branch,
          event: r.event,
          created_at: r.created_at,
          updated_at: r.updated_at,
          html_url: r.html_url,
          run_number: r.run_number,
          actor: r.actor?.login,
          actor_avatar: r.actor?.avatar_url,
        }));

        const deployments = (deploys as any[]).map((d: any) => ({
          id: d.id,
          environment: d.environment,
          ref: d.ref,
          task: d.task,
          created_at: d.created_at,
          updated_at: d.updated_at,
          creator: d.creator?.login,
          description: d.description,
        }));

        return { repo, pullRequests, ciRuns, deployments };
      }));

      // Collect all PRs across repos
      const allPRs = repoResults.flatMap((r) => r.pullRequests);

      // Split into my PRs and review requests
      const myPRs = currentUser
        ? allPRs.filter((pr) => pr.user === currentUser)
        : [];
      const reviewRequests = currentUser
        ? allPRs.filter((pr) =>
            pr.user !== currentUser &&
            pr.requested_reviewers.includes(currentUser!)
          )
        : [];

      // Fetch reviews + check status for my PRs (to show what's pending)
      await Promise.all(myPRs.map(async (pr) => {
        const [owner, repoName] = pr.repo.split("/");
        const [reviews, checks] = await Promise.all([
          ghFetch(`/repos/${pr.repo}/pulls/${pr.number}/reviews`, token).catch(() => []),
          ghFetch(`/repos/${owner}/${repoName}/commits/${pr.head_sha}/check-runs?per_page=50`, token).catch(() => ({ check_runs: [] })),
        ]);
        pr.reviews = (reviews as any[]).map((r: any) => ({
          user: r.user.login,
          state: r.state,
          submitted_at: r.submitted_at,
        }));
        const runs = ((checks as any).check_runs ?? []) as any[];
        const total = runs.length;
        const success = runs.filter((c: any) => c.conclusion === "success").length;
        const failure = runs.filter((c: any) => c.conclusion === "failure").length;
        const pending = runs.filter((c: any) => c.status === "in_progress" || c.status === "queued").length;
        pr.checks = { total, success, failure, pending };
      }));

      // For review requests: fetch reviews to check if user already reviewed but not approved
      // (requested_reviewers only includes people who haven't submitted any review yet,
      //  so these are truly pending)

      // Collect user's CI runs across all repos
      const myCIRuns = currentUser
        ? repoResults.flatMap((r) =>
            r.ciRuns
              .filter((c: any) => c.actor === currentUser)
              .map((c: any) => ({ ...c, repo: r.repo }))
          )
        : [];
      myCIRuns.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Collect all CI runs (for repo overview)
      const allCIRuns = repoResults.flatMap((r) =>
        r.ciRuns.map((c: any) => ({ ...c, repo: r.repo }))
      );
      allCIRuns.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      res.json({
        currentUser,
        repos: repoResults.map((r) => ({
          repo: r.repo,
          deployments: r.deployments,
          ciSummary: {
            total: r.ciRuns.length,
            success: r.ciRuns.filter((c: any) => c.conclusion === "success").length,
            failure: r.ciRuns.filter((c: any) => c.conclusion === "failure").length,
            running: r.ciRuns.filter((c: any) => c.status === "in_progress" || c.status === "queued").length,
          },
        })),
        myPRs,
        reviewRequests,
        myCIRuns: myCIRuns.slice(0, 20),
        recentCIRuns: allCIRuns.slice(0, 15),
      });
    } catch (e: any) {
      res.status(502).json({ error: e.message });
    }
  });

  // ── PR reviews for a specific PR ──

  router.get("/repos/:owner/:repo/pulls/:number/reviews", async (req, res) => {
    const token = db.getEncryptedSetting("github_token");
    if (!token) { res.status(401).json({ error: "No GitHub token configured" }); return; }
    try {
      const { owner, repo, number } = req.params;
      const data = await ghFetch(`/repos/${owner}/${repo}/pulls/${number}/reviews`, token);
      res.json(data);
    } catch (e: any) {
      res.status(502).json({ error: e.message });
    }
  });

  return router;
}
