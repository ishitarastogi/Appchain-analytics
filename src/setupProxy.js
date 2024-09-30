// src/setupProxy.js
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/api/proxy",
    createProxyMiddleware({
      target: "http://your-api-target", // Replace with your actual API target
      changeOrigin: true,
      pathRewrite: {
        "^/api/proxy": "", // Remove '/api/proxy' from the path
      },
    })
  );
};
