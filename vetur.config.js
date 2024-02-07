module.exports = {
  settings: {
    "vetur.useWorkspaceDependencies": true,
    "vetur.experimental.templateInterpolationService": true
  },
  projects: [
    {
      root: "./src",
      package: "./package.json",
      tsconfig: "./tsconfig.json"
    }
  ]
}