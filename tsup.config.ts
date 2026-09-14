import { defineConfig } from "tsup"

// dist/ is cleared once by the build script, not here: these two builds run
// side by side, and either one cleaning could delete the other's output.
export default defineConfig([
  // The client: ES modules and CommonJS.
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: false,
    target: "es2020",
  },
  // The OpenVerb integration: ES modules only, because openverb is. It imports
  // the client by the package's own name, kept external so it isn't bundled twice.
  {
    entry: { openverb: "src/openverb.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: false,
    target: "es2020",
    external: ["openverb", "@openverb/music-atlas"],
  },
])
