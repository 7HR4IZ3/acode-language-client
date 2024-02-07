const { exec } = require("child_process");
const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = (env, options) => {
  const { mode = "development" } = options;
  const rules = [
    {
      test: /\.m?js$/,
      use: [
        "html-tag-js/jsx/tag-loader.js",
        {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      ],
    },
    {
      test: /\.ts$/,
      use: "ts-loader",
      exclude: /node_modules/,
    },
  ];

  const main = {
    mode,
    entry: {
      main: "./src/main.js",
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].js",
      chunkFilename: "[name].js",
    },
    module: {
      rules,
    },
    resolve: {
      extensions: [".ts", ".js"],
    },
    plugins: [
      {
        apply: (compiler) => {
          compiler.hooks.afterDone.tap("pack-zip", () => {
            // run pack-zip.js
            exec("node .vscode/pack-zip.js", (err, stdout, stderr) => {
              if (err) {
                console.error(err);
                return;
              }
              console.log(stdout);
            });
          });
        },
      },
    ],
    optimization: {
      minimizer: [
        new TerserPlugin({
          // Use multi-process parallel running to improve the build speed
          // Default number of concurrent runs: os.cpus().length - 1
          parallel: true,
          // Enable file caching
          // cache: true,
          // minify: true
        }),
      ],
    },
  };

  return [main];
};
