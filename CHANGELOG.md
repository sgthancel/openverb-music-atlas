# Changelog

## 0.2.0

The Solar System collection, beside the World Music Atlas. Nothing was removed or renamed.

- `solarSystem()`, `bodies()` with kind, zone and orbits filters, `body()` and `findBody()`
- `SOLAR_EDITION`, and `embedUrl()` / `embedHtml()` for a body's player
- Each body carries the established astronomy its song was written from, in `facts`, and a count of the `takes` kept
- Types: `SolarBody`, `SolarEdition`, `SolarCollection`, `SolarBodyDetail`, `BodyKind`, `BodyFilter`, `BodyRef`
- OpenVerb: four more read-only verbs — `find_body`, `list_bodies`, `get_body_song`, `get_solar_system` (twelve in all)

## 0.1.0

First release of `@openverb/music-atlas`, for the Open Music Atlas API v1.

- `OpenMusicAtlas` client and the ready-made `atlas` instance
- `places()` with continent, region and kind filters; `place()`; `editions()`; `edition()`; `geojson()`
- `find()` / `country()` by slug, ISO code or name; `search()`
- `embedUrl()`, `embedHtml()` and, in the browser, `createEmbed()`
- `OpenMusicAtlasError` with `status` and `retryAfter`
- TypeScript types for every API shape; ES modules and CommonJS
- OpenVerb: the `openverb.music_atlas` verb library (eight read-only verbs), `createMusicAtlasExecutor()` and `registerMusicAtlasVerbs()` at `@openverb/music-atlas/openverb`, with `openverb` as an optional peer dependency
