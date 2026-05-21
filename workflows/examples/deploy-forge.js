module.exports = {
  name: "Deploy Forge App",
  description: "Build FE, start ngrok tunnel, update manifest, and forge deploy",
  icon: "rocket",
  tags: ["forge", "deploy"],
  async run({ exec, log }) {
    log("Building frontend...");
    await exec("npm run build", {
      cwd: "~/Desktop/code/tm/tm_forge_app_worktree",
      timeout: 300,
    });
    log("Deploy step would go here...");
  },
};
