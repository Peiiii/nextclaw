import { cp, mkdir } from "node:fs/promises";

const packageRoot = new URL("../", import.meta.url);

await mkdir(new URL("dist", packageRoot), { recursive: true });
await cp(new URL("resources/extension", packageRoot), new URL("dist/extension", packageRoot), {
  recursive: true,
});
