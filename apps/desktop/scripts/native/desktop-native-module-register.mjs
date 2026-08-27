import { register } from "node:module";

register(
  new URL("./desktop-native-module-loader.mjs", import.meta.url),
  import.meta.url,
);
