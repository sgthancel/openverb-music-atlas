# Changelog

## 0.1.0

First release of `@openverb/music-atlas`, for the Open Music Atlas API v1.

- `OpenMusicAtlas` client and the ready-made `atlas` instance
- `places()` with continent, region and kind filters; `place()`; `editions()`; `edition()`; `geojson()`
- `find()` / `country()` by slug, ISO code or name; `search()`
- `embedUrl()`, `embedHtml()` and, in the browser, `createEmbed()`
- `OpenMusicAtlasError` with `status` and `retryAfter`
- TypeScript types for every API shape; ES modules and CommonJS
- OpenVerb: the `openverb.music_atlas` verb library (eight read-only verbs), `createMusicAtlasExecutor()` and `registerMusicAtlasVerbs()` at `@openverb/music-atlas/openverb`, with `openverb` as an optional peer dependency
