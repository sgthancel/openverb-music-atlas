// Live tests against https://openmusicatlas.org. Read-only and light: a handful of requests.
// Run with: npm run test:live
import { test } from "node:test"
import assert from "node:assert/strict"
import { atlas, FOUNDING_EDITION } from "../dist/index.js"
import { createMusicAtlasExecutor } from "../dist/openverb.js"

const PROVIDER = /suno/i
const ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

test("the live atlas has every place, with coordinates", async () => {
  const places = await atlas.places()
  assert.ok(places.length >= 203, `expected at least 203 places, got ${places.length}`)
  assert.ok(places.every((p) => p.slug && p.name && p.pageUrl.startsWith("https://openmusicatlas.org/place/")))
  assert.ok(places.filter((p) => p.coordinates).length >= 203)
})

test("country('Jamaica') finds Jamaica in the Caribbean", async () => {
  const jamaica = await atlas.country("Jamaica")
  assert.equal(jamaica?.isoCode, "JM")
  assert.equal(jamaica?.region, "Caribbean")
})

test("a place has its Founding Edition song, and the embed URL matches the client's", async () => {
  const detail = await atlas.place("jamaica")
  assert.ok(detail)
  const founding = detail.entries.find((e) => e.edition.slug === FOUNDING_EDITION)
  assert.ok(founding, "no Founding Edition entry")
  assert.equal(founding.entry.embedUrl, atlas.embedUrl("jamaica"))
  assert.ok(founding.entry.title)
})

test("the Founding Edition is frozen and has an entry for every place", async () => {
  const [places, detail] = await Promise.all([atlas.places(), atlas.edition()])
  assert.ok(detail)
  assert.equal(detail.edition.version, 1)
  assert.ok(detail.edition.frozenAt)
  assert.equal(detail.entries.length, places.length)
})

test("the GeoJSON has a point for every place", async () => {
  const [places, geo] = await Promise.all([atlas.places(), atlas.geojson()])
  assert.equal(geo?.type, "FeatureCollection")
  assert.equal(geo.features.length, places.length)
  const f = geo.features[0]
  assert.equal(f.geometry.type, "Point")
  assert.equal(f.geometry.coordinates.length, 2)
  assert.ok(f.properties.embedUrl.startsWith("https://openmusicatlas.org/embed/"))
})

test("nothing the API returns names the audio provider or carries an id", async () => {
  const [places, detail, geo] = await Promise.all([atlas.places(), atlas.place("jamaica"), atlas.geojson()])
  for (const body of [places, detail, geo].map((x) => JSON.stringify(x))) {
    assert.ok(!PROVIDER.test(body), "response mentions the provider")
    assert.ok(!ID.test(body), "response contains an id")
  }
})

test("a place that doesn't exist is null, not an error", async () => {
  assert.equal(await atlas.place("atlantis"), null)
})

test("an OpenVerb agent can ask for a place's song", async () => {
  const executor = createMusicAtlasExecutor()
  const result = await executor.execute({ verb: "get_place_song", params: { place: "Jamaica" } })
  assert.equal(result.status, "success")
  assert.ok(result.data.entry.title)
  assert.equal(result.data.entry.embedUrl, atlas.embedUrl("jamaica"))
})
