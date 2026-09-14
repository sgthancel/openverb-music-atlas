# @openverb/music-atlas

The official SDK for [Open Music Atlas](https://openmusicatlas.org) — the world, mapped in music. Every place in the **World Music Atlas**, its song, editions, GeoJSON and embeddable players, in your code. Part of the [OpenVerb](https://openverb.org) developer ecosystem.

- A thin, typed wrapper around the [Open Music Atlas API v1](https://openmusicatlas.org/developers)
- No dependencies. Works in Node 18+, browsers, Deno and Bun
- ES modules and CommonJS, with TypeScript types
- OpenVerb verbs, so AI agents can explore the atlas

```bash
npm install @openverb/music-atlas
```

## Quick start

```js
import { atlas } from "@openverb/music-atlas"

const jamaica = await atlas.country("Jamaica")
// { slug: "jamaica", name: "Jamaica", isoCode: "JM", continent: "Americas",
//   region: "Caribbean", coordinates: [-77.32, 18.14], ... }

const { entries } = await atlas.place("jamaica")
console.log(entries[0].entry.title)     // "Island of One People"
console.log(entries[0].entry.embedUrl)  // the embeddable player
```

CommonJS works too:

```js
const { atlas } = require("@openverb/music-atlas")
```

## Places

```js
const all = await atlas.places()                          // every place, in listening order
const caribbean = await atlas.places({ region: "Caribbean" })
const africa = await atlas.places({ continent: "Africa" })

await atlas.find("JM")              // by ISO code
await atlas.find("cote d'ivoire")   // by name — case- and accent-insensitive
await atlas.search("guinea")        // Guinea, Guinea-Bissau, Equatorial Guinea, Papua New Guinea
```

`places()` is fetched once per client and served from memory afterwards, so `find()` and `search()` are cheap.

Regions and continents follow the UN M49 scheme. Where a place's classification is contested, its `kind` is `"place"` and `isDisputed` is `true`; inclusion in the atlas is not a statement about sovereignty. See the [curatorial policy](https://openmusicatlas.org/curatorial-policy).

## Editions

An edition gives every place a song. Once published, an edition is frozen: its songs never change.

```js
const editions = await atlas.editions()
const founding = await atlas.edition()          // defaults to the 2026 Founding Edition
founding.entries.forEach(({ place, entry }) => console.log(place.name, "—", entry.title))
```

## GeoJSON

One point per place, with the place and its song as properties.

```js
const geo = await atlas.geojson()   // FeatureCollection

// Leaflet: every place a marker, every popup a player
L.geoJSON(geo, {
  onEachFeature: (feature, layer) => {
    const p = feature.properties
    layer.bindPopup(`<b>${p.name}</b><br>${p.title}<br>` + atlas.embedHtml(p.slug, p.edition, { width: 300 }))
  },
}).addTo(map)

// MapLibre / Mapbox
map.addSource("atlas", { type: "geojson", data: geo })
```

## Embedding the player

Songs are heard through the Open Music Atlas player. It runs in its own protected frame and links back to the place's page.

```js
atlas.embedUrl("jamaica")    // "https://openmusicatlas.org/embed/jamaica/2026-founding"
atlas.embedHtml("jamaica")   // an <iframe> string, for servers, templates and popups

// In the browser
document.querySelector("#player").append(atlas.createEmbed("jamaica"))
```

The player fits a frame 212px tall (`EMBED_HEIGHT`) without scrolling.

## For AI agents: OpenVerb

The package ships an [OpenVerb](https://openverb.org) verb library, `openverb.music_atlas`, that describes what an AI may do with the atlas — find places, get a place's song or its player, list editions, get GeoJSON. Every verb is read-only.

```bash
npm install openverb
```

```js
import { createMusicAtlasExecutor } from "@openverb/music-atlas/openverb"

const executor = createMusicAtlasExecutor()

await executor.execute({ verb: "get_place_song", params: { place: "Jamaica" } })
// { verb: "get_place_song", status: "success",
//   data: { place: {...}, edition: {...}, entry: { title: "Island of One People", embedUrl: "..." } } }

await executor.execute({ verb: "list_places", params: { region: "Caribbean" } })
```

| Verb | What it does |
|---|---|
| `find_place` | One place by name, ISO code or slug |
| `search_places` | Places whose name contains the query |
| `list_places` | Places, optionally by continent, region or kind |
| `get_place_song` | A place's song in an edition |
| `get_embed_player` | A place's player URL and iframe |
| `list_editions` | Every published edition |
| `get_edition` | An edition and all its songs |
| `get_geojson` | An edition as GeoJSON |

The library itself is `@openverb/music-atlas/openverb.music_atlas.json`, or `musicAtlasLibrary` in code, ready to hand to a model as its list of available actions. Already have an executor? `registerMusicAtlasVerbs(executor)` adds the handlers to it.

The OpenVerb integration is ES-module only, because `openverb` is. Everything else also works with `require()`.

## Errors and limits

`place()`, `edition()` and `geojson()` return `null` for something that doesn't exist. Other failures throw an `OpenMusicAtlasError`, which carries the HTTP `status` and, when the API gives one, `retryAfter` in seconds. (OpenVerb verbs report failures as `status: "error"` results instead.)

```js
import { OpenMusicAtlasError } from "@openverb/music-atlas"

try {
  await atlas.editions()
} catch (e) {
  if (e instanceof OpenMusicAtlasError && e.status === 429) console.log(`Wait ${e.retryAfter}s`)
}
```

The API allows each caller 300 requests every 10 minutes, and responses are cached for an hour. Keep one client and reuse it.

## Options

```js
import { OpenMusicAtlas } from "@openverb/music-atlas"

const client = new OpenMusicAtlas({
  baseUrl: "https://openmusicatlas.org",  // the default
  fetch: customFetch,                     // optional; defaults to the global fetch
  headers: { "X-App": "my-museum-kiosk" },
})
```

## What's included — and what isn't

The API and this package give you places, coordinates, songs' titles, descriptions and styles, editions, page links and embeddable players. They give you **no audio files, no downloadable audio links and no audio-provider identifiers**: songs are always heard through the player.

## License

The code in this package is MIT-licensed. The atlas's data and its music are licensed separately: the music is not licensed for download or reuse, and the terms for the data are published at [openmusicatlas.org/developers](https://openmusicatlas.org/developers). Please credit "World Music Atlas, openmusicatlas.org" and link to the place pages.
