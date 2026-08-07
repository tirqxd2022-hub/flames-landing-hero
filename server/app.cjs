// CommonJS bootstrap for cPanel/LiteSpeed lsnode.
// lsnode uses require() to load this file. Our app is ESM (and some deps use
// top-level await), so we must load it via dynamic import() instead of
// converting the whole codebase. require()-ing an ESM graph with TLA throws
// ERR_REQUIRE_ASYNC_MODULE on Node 22.
"use strict";

(async () => {
  try {
    const mod = await import("./src/index.js");
    await mod.startServer();
  } catch (err) {
    console.error("[bootstrap] failed to start server:", err);
    process.exit(1);
  }
})();
