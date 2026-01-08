/**
 * Tome - Web Fiction Proxy for E-ink Devices
 * Main entry point
 */
import { PORT, ENABLE_BROWSER } from "./config";
import { handleRequest } from "./routes";
import { initBrowser, closeBrowser } from "./services/scraper";
import { startJobs, stopJobs } from "./services/jobs";
import { seedAdminUser } from "./lib/auth";

console.log("Starting Tome...");

seedAdminUser()
  .then(() => ENABLE_BROWSER ? initBrowser() : Promise.resolve())
  .then(() => {
    startJobs();
  })
  .catch(console.error);

// Start HTTP server
const server = Bun.serve({
  port: PORT,
  fetch: handleRequest,
  idleTimeout: 120, // 2 minutes - allow time for slow scraping operations
});

console.log(`Tome running at http://localhost:${server.port}`);
console.log("Press Ctrl+C to stop");

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  stopJobs();
  if (ENABLE_BROWSER) await closeBrowser();
  process.exit(0);
});
