// The CommonJS build of the client works with require(). (The OpenVerb
// integration is ES-module only, like openverb itself.)
const { test } = require("node:test")
const assert = require("node:assert/strict")
const pkg = require("../dist/index.cjs")

test("require() exposes the same API as import", () => {
  assert.equal(typeof pkg.OpenMusicAtlas, "function")
  assert.equal(typeof pkg.atlas.country, "function")
  assert.equal(pkg.FOUNDING_EDITION, "2026-founding")
  assert.equal(pkg.atlas.embedUrl("jamaica"), "https://openmusicatlas.org/embed/jamaica/2026-founding")
})
