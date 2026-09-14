// The OpenVerb integration, offline: a fake fetch stands in for the API.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createExecutor } from "openverb"
import { OpenMusicAtlas } from "../dist/index.js"
import {
  createMusicAtlasExecutor,
  registerMusicAtlasVerbs,
  musicAtlasLibrary,
  MUSIC_ATLAS_NAMESPACE,
} from "../dist/openverb.js"

const JAMAICA = { slug: "jamaica", name: "Jamaica", isoCode: "JM", kind: "country", continent: "Americas", region: "Caribbean", coordinates: [-77.32, 18.14], isDisputed: false, pageUrl: "https://openmusicatlas.org/place/jamaica" }
const EDITION = { slug: "2026-founding", name: "World Music Atlas — 2026 Founding Edition", year: 2026, version: 1, frozenAt: "2026-09-13T23:36:12.000Z" }
const ENTRY = { title: "Island of One People", description: null, style: "reggae", curatorsSelection: false, pageUrl: JAMAICA.pageUrl, embedUrl: "https://openmusicatlas.org/embed/jamaica/2026-founding" }

const routes = {
  "/api/v1/places": { places: [JAMAICA] },
  "/api/v1/places/jamaica": { place: JAMAICA, entries: [{ edition: EDITION, entry: ENTRY }] },
  "/api/v1/editions": { editions: [{ ...EDITION, collection: "world-music-atlas", styleConstraint: null, entryCount: 1, pageUrl: "https://openmusicatlas.org/editions/2026-founding" }] },
}
const fakeFetch = async (url) => {
  const body = routes[new URL(url).pathname]
  return new Response(JSON.stringify(body ?? { error: "Not found" }), { status: body ? 200 : 404 })
}
const executor = () => createMusicAtlasExecutor(new OpenMusicAtlas({ fetch: fakeFetch }))

test("the OpenVerb entry shares the main client rather than bundling its own copy", () => {
  const built = readFileSync(new URL("../dist/openverb.js", import.meta.url), "utf8")
  assert.match(built, /from "@openverb\/music-atlas"/)
  assert.doesNotMatch(built, /class OpenMusicAtlas\b/)
  const types = readFileSync(new URL("../dist/openverb.d.ts", import.meta.url), "utf8")
  assert.doesNotMatch(types, /declare class OpenMusicAtlas\b/)
})

test("the library is a valid OpenVerb library of read-only verbs", () => {
  assert.equal(musicAtlasLibrary.namespace, MUSIC_ATLAS_NAMESPACE)
  assert.ok(musicAtlasLibrary.verbs.length >= 8)
  for (const v of musicAtlasLibrary.verbs) {
    assert.ok(v.name && v.category && v.description && v.params, `incomplete verb ${v.name}`)
    assert.equal(v.destructive, false, `${v.name} should be read-only`)
  }
})

test("every verb in the library has a handler", async () => {
  const ex = executor()
  for (const v of musicAtlasLibrary.verbs) {
    const params = Object.fromEntries(Object.entries(v.params).filter(([, p]) => p.required).map(([k]) => [k, "jamaica"]))
    const result = await ex.execute({ verb: v.name, params })
    assert.ok(!/No handler registered/.test(result.error_message ?? ""), `${v.name} has no handler`)
  }
})

test("find_place finds by name and reports a miss as an error result", async () => {
  const ex = executor()
  const hit = await ex.execute({ verb: "find_place", params: { query: "Jamaica" } })
  assert.equal(hit.status, "success")
  assert.equal(hit.data.place.isoCode, "JM")
  const miss = await ex.execute({ verb: "find_place", params: { query: "Atlantis" } })
  assert.equal(miss.status, "error")
  assert.match(miss.error_message, /Atlantis/)
})

test("get_place_song returns the Founding Edition song by default", async () => {
  const r = await executor().execute({ verb: "get_place_song", params: { place: "JM" } })
  assert.equal(r.status, "success")
  assert.equal(r.data.entry.title, "Island of One People")
  assert.equal(r.data.edition.slug, "2026-founding")
  const none = await executor().execute({ verb: "get_place_song", params: { place: "jamaica", edition: "2099-future" } })
  assert.equal(none.status, "error")
})

test("get_embed_player returns the player URL and an iframe", async () => {
  const r = await executor().execute({ verb: "get_embed_player", params: { place: "jamaica", width: "300" } })
  assert.equal(r.status, "success")
  assert.equal(r.data.embed_url, "https://openmusicatlas.org/embed/jamaica/2026-founding")
  assert.match(r.data.html, /^<iframe src="https:\/\/openmusicatlas\.org\/embed\/jamaica\/2026-founding" width="300"/)
})

test("list_places and list_editions return lists with counts", async () => {
  const ex = executor()
  const places = await ex.execute({ verb: "list_places", params: { region: "caribbean" } })
  assert.equal(places.data.count, 1)
  const editions = await ex.execute({ verb: "list_editions", params: {} })
  assert.equal(editions.data.editions[0].slug, "2026-founding")
})

test("OpenVerb's own validation still applies: a missing required param is refused", async () => {
  const r = await executor().execute({ verb: "get_place_song", params: {} })
  assert.equal(r.status, "error")
  assert.match(r.error_message, /Missing required param: place/)
})

test("registerMusicAtlasVerbs works on an executor you created yourself", async () => {
  const ex = createExecutor(musicAtlasLibrary)
  registerMusicAtlasVerbs(ex, new OpenMusicAtlas({ fetch: fakeFetch }))
  const r = await ex.execute({ verb: "find_place", params: { query: "jamaica" } })
  assert.equal(r.data.place.slug, "jamaica")
})
