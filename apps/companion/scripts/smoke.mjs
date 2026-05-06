import { existsSync } from "node:fs";
import { resolve } from "node:path";

const requiredFiles = [
  resolve("dist/electron/main.js"),
  resolve("dist/electron/launcher.js"),
  resolve("dist/electron/preload.js"),
  resolve("dist/ui/index.html")
];

const missingFiles = requiredFiles.filter((filePath) => !existsSync(filePath));

if (missingFiles.length > 0) {
  console.error("Missing companion build artifacts:");
  for (const filePath of missingFiles) {
    console.error(`- ${filePath}`);
  }
  process.exit(1);
}

console.log("Companion smoke passed.");
