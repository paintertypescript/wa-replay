const fs = require("node:fs");
const path = require("node:path");

// Only this app's disposable debug profile is reset. Keep normal Edge profiles intact.
const profile = path.resolve(__dirname, "../.vscode/.edge-debug-profile");
try {
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  fs.mkdirSync(profile, { recursive: true });
  console.log("Created a fresh wa-replay debug browser profile.");
} catch {
  console.error("Cannot reset the debug profile. Close the previous wa-replay debug browser window, then press F5 again.");
  process.exitCode = 1;
}
