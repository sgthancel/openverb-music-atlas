// Offline tests: the network is replaced with a fake fetch.
import { test } from "node:test"
import assert from "node:assert/strict"
import { OpenMusicAtlas, OpenMusicAtlasError, FOUNDING_EDITION, EMBED_HEIGHT, atlas } from "../dist/index.js"

const PLACES = [
  { slug: "jamaica", name: "Jamaica", isoCode: "JM", kind: "country", continent: "Americas", region: "Caribbean", coordinates: [-77.32, 18.14], isDisputed: false, pageUrl: "https://openmusicatlas.org/place/jamaica" },
  { slug: "cote-divoire", name: "Côte d'Ivoire", isoCode: "CI", kind: "country", continent: "Africa", region: "Western Africa", coordinates: [-5.61, 7.55], isDisputed: false, pageUrl: "https://openmusicatlas.org/place/cote-divoire" },
  { slug: "japan", name: "Japan", isoCode: "JP", kind: "country", continent: "Asia", region: "Eastern Asia", coordinates: [138.2, 36.2], isDisputed: false, pageUrl: "https://openmusicatlas.org/place/japan" },
  { slug: "taiwan", name: "Taiwan", isoCode: "TW", kind: "place", continent: "Asia", region: "Eastern Asia", coordinates: [120.97, 23.74], isDisputed: true, pageUrl: "https://openmusicatlas.org/place/taiwan" },
]

/** A fake fetch that answers from a table of path → [status, body, headers], and records calls. */
function fakeFetch(routes) {
  const calls = []
  const fn = async (url, init) => {
    calls.push({ url, init })
    const path = new URL(url).pathname
    const [status, body, headers = {}] = routes[path] ?? [404, { error: "Not found" }]
    return new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...headers },
    })
  }
  fn.calls = calls
  return fn
}

const client = (routes, opts = {}) => {
  const f = fakeFetch(routes)
  return { c: new OpenMusicAtlas({ fetch: f, ...opts }), f }
}

test("places() fetches once and serves later calls from memory", async () => {
  const { c, f } = client({ "/api/v1/places": [200, { count: 4, places: PLACES }] })
  assert.equal((await c.places()).length, 4)
  assert.equal((await c.places()).length, 4)
  assert.equal(f.calls.length, 1)
})

test("places() filters by continent, region and kind, ignoring case", async () => {
  const { c } = client({ "/api/v1/places": [200, { places: PLACES }] })
  assert.deepEqual((await c.places({ continent: "asia" })).map((p) => p.slug), ["japan", "taiwan"])
  assert.deepEqual((await c.places({ region: "CARIBBEAN" })).map((p) => p.slug), ["jamaica"])
  assert.deepEqual((await c.places({ kind: "place" })).map((p) => p.slug), ["taiwan"])
})

test("a failed places() load is not remembered", async () => {
  let fail = true
  const f = async () =>
    fail ? new Response("{}", { status: 500 }) : new Response(JSON.stringify({ places: PLACES }), { status: 200 })
  const c = new OpenMusicAtlas({ fetch: f })
  await assert.rejects(c.places())
  fail = false
  assert.equal((await c.places()).length, 4)
})

test("find() and country() match slug, ISO code and name, without regard to case or accents", async () => {
  const { c } = client({ "/api/v1/places": [200, { places: PLACES }] })
  assert.equal((await c.find("jamaica"))?.name, "Jamaica")
  assert.equal((await c.find("JM"))?.slug, "jamaica")
  assert.equal((await c.country("Jamaica"))?.isoCode, "JM")
  assert.equal((await c.find("cote d'ivoire"))?.slug, "cote-divoire")
  assert.equal((await c.find("  CÔTE D'IVOIRE "))?.slug, "cote-divoire")
  assert.equal((await c.find("jap"))?.slug, "japan")
  assert.equal(await c.find("atlantis"), null)
  assert.equal(await c.find(""), null)
})

test("search() returns names containing the query, prefix matches first", async () => {
  const { c } = client({ "/api/v1/places": [200, { places: PLACES }] })
  assert.deepEqual((await c.search("a")).map((p) => p.slug).slice(0, 2), ["jamaica", "japan"])
  assert.deepEqual((await c.search("ivo")).map((p) => p.slug), ["cote-divoire"])
  assert.deepEqual(await c.search("  "), [])
})

test("place(), edition() and geojson() return null for something that doesn't exist", async () => {
  const { c } = client({})
  assert.equal(await c.place("atlantis"), null)
  assert.equal(await c.edition("1999"), null)
  assert.equal(await c.geojson("1999"), null)
})

test("edition() and geojson() default to the Founding Edition", async () => {
  const { c, f } = client({
    [`/api/v1/editions/${FOUNDING_EDITION}`]: [200, { edition: { slug: FOUNDING_EDITION }, entries: [] }],
    [`/api/v1/editions/${FOUNDING_EDITION}.geojson`]: [200, { type: "FeatureCollection", features: [] }],
  })
  assert.equal((await c.edition())?.edition.slug, FOUNDING_EDITION)
  assert.equal((await c.geojson())?.type, "FeatureCollection")
  assert.ok(f.calls[1].url.endsWith(".geojson"))
})

test("place() accepts a Place object as well as a slug, and encodes it", async () => {
  const { c, f } = client({ "/api/v1/places/jamaica": [200, { place: PLACES[0], entries: [] }] })
  assert.equal((await c.place(PLACES[0]))?.place.slug, "jamaica")
  await c.place("a b")
  assert.ok(f.calls[1].url.endsWith("/api/v1/places/a%20b"))
})

test("errors carry the status, the API's message and Retry-After", async () => {
  const { c } = client({
    "/api/v1/editions": [429, { error: "Rate limit exceeded. Try again in a few minutes." }, { "retry-after": "600" }],
  })
  await assert.rejects(c.editions(), (e) => {
    assert.ok(e instanceof OpenMusicAtlasError)
    assert.equal(e.status, 429)
    assert.equal(e.retryAfter, 600)
    assert.match(e.message, /Rate limit/)
    return true
  })
})

test("a non-JSON error still produces a readable message", async () => {
  const { c } = client({ "/api/v1/editions": [502, "<html>Bad gateway</html>"] })
  await assert.rejects(c.editions(), (e) => e.status === 502 && /502/.test(e.message) && e.retryAfter === null)
})

test("requests go to the base URL with JSON headers; trailing slashes are trimmed", async () => {
  const { c, f } = client({ "/api/v1/places": [200, { places: [] }] }, {
    baseUrl: "https://example.test/",
    headers: { "X-App": "demo" },
  })
  await c.places()
  assert.equal(f.calls[0].url, "https://example.test/api/v1/places")
  assert.equal(f.calls[0].init.headers.Accept, "application/json")
  assert.equal(f.calls[0].init.headers["X-App"], "demo")
})

test("embedUrl() builds the player address without a request", () => {
  const c = new OpenMusicAtlas({ fetch: () => assert.fail("no request expected") })
  assert.equal(c.embedUrl("jamaica"), `https://openmusicatlas.org/embed/jamaica/${FOUNDING_EDITION}`)
  assert.equal(c.embedUrl(PLACES[0], "2027-orchestral"), "https://openmusicatlas.org/embed/jamaica/2027-orchestral")
})

test("embedHtml() produces an escaped iframe at the height that fits the player", () => {
  const html = atlas.embedHtml(PLACES[1])
  assert.match(html, /^<iframe src="https:\/\/openmusicatlas\.org\/embed\/cote-divoire\/2026-founding"/)
  assert.match(html, new RegExp(`height="${EMBED_HEIGHT}"`))
  assert.match(html, /title="Côte d&quot;Ivoire|title="Côte d'Ivoire — World Music Atlas"/)
  const custom = atlas.embedHtml("jamaica", FOUNDING_EDITION, { width: 300, height: 220, title: 'A "quoted" <title>' })
  assert.match(custom, /width="300" height="220"/)
  assert.match(custom, /title="A &quot;quoted&quot; &lt;title&gt;"/)
})

test("createEmbed() explains itself outside a browser", () => {
  assert.throws(() => atlas.createEmbed("jamaica"), /needs a browser/)
})

test("importing the package makes no request, even without fetch", async () => {
  const saved = globalThis.fetch
  try {
    globalThis.fetch = undefined
    const c = new OpenMusicAtlas()
    await assert.rejects(c.places(), /No fetch is available/)
  } finally {
    globalThis.fetch = saved
  }
})
