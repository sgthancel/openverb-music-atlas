/**
 * Open Music Atlas as OpenVerb verbs, so an AI agent built on OpenVerb can
 * find places and the bodies of the Solar System, their songs, editions,
 * GeoJSON and players.
 *
 * ```ts
 * import { createMusicAtlasExecutor } from "@openverb/music-atlas/openverb"
 *
 * const executor = createMusicAtlasExecutor()
 * await executor.execute({ verb: "get_place_song", params: { place: "Jamaica" } })
 * ```
 *
 * Needs `openverb` (npm install openverb). Every verb is read-only.
 */
import { createExecutor, loadLibrary } from "openverb"
import type { ActionResult, VerbHandler, VerbLibrary } from "openverb"
import library from "../openverb.music_atlas.json"
// By package name, not "./index": the built file then shares the main entry's
// client instead of carrying its own copy, whose class TypeScript would treat
// as a different type from the OpenMusicAtlas you import and pass in.
import {
  atlas,
  FOUNDING_EDITION,
  type BodyKind,
  type OpenMusicAtlas,
  type Place,
  type PlaceKind,
  type SolarBody,
} from "@openverb/music-atlas"

export const MUSIC_ATLAS_NAMESPACE = "openverb.music_atlas"

/** The verb library: everything an AI may do with Open Music Atlas. */
// The JSON's inferred type is narrower than VerbLibrary's open records, hence via unknown.
export const musicAtlasLibrary: VerbLibrary = loadLibrary(library as unknown as VerbLibrary)

/** Anything handlers can be registered on — an OpenVerb executor, or your own registry. */
export interface VerbRegistrar {
  register(verbName: string, handler: VerbHandler): void
}

const ok = (verb: string, data: unknown): ActionResult => ({ verb, status: "success", data })
const fail = (verb: string, message: string): ActionResult => ({ verb, status: "error", error_message: message })
const text = (v: unknown) => (v === undefined || v === null || v === "" ? undefined : String(v))

/**
 * Register a handler for every Music Atlas verb on an executor, using the
 * given client (by default, the one for https://openmusicatlas.org).
 */
export function registerMusicAtlasVerbs(executor: VerbRegistrar, client: OpenMusicAtlas = atlas): void {
  // Typed explicitly: an inferred union gives both branches an optional
  // `error`, and `"error" in found` would no longer tell them apart.
  const findOrFail = async (verb: string, query: unknown): Promise<{ place: Place } | { error: ActionResult }> => {
    const place = await client.find(String(query ?? ""))
    return place ? { place } : { error: fail(verb, `No place in the atlas matches "${query}".`) }
  }

  executor.register("find_place", async ({ query }) => {
    const found = await findOrFail("find_place", query)
    return "error" in found ? found.error : ok("find_place", { place: found.place })
  })

  executor.register("search_places", async ({ query }) => {
    const places = await client.search(String(query ?? ""))
    return ok("search_places", { places, count: places.length })
  })

  executor.register("list_places", async ({ continent, region, kind }) => {
    const places = await client.places({
      continent: text(continent),
      region: text(region),
      kind: text(kind) as PlaceKind | undefined,
    })
    return ok("list_places", { places, count: places.length })
  })

  executor.register("get_place_song", async ({ place, edition }) => {
    const found = await findOrFail("get_place_song", place)
    if ("error" in found) return found.error
    const slug = text(edition) ?? FOUNDING_EDITION
    const detail = await client.place(found.place.slug)
    const match = detail?.entries.find((e) => e.edition.slug === slug)
    if (!match) return fail("get_place_song", `${found.place.name} has no song in the edition "${slug}".`)
    return ok("get_place_song", { place: found.place, edition: match.edition, entry: match.entry })
  })

  executor.register("get_embed_player", async ({ place, edition, width, height }) => {
    const found = await findOrFail("get_embed_player", place)
    if ("error" in found) return found.error
    const slug = text(edition) ?? FOUNDING_EDITION
    return ok("get_embed_player", {
      place: found.place,
      embed_url: client.embedUrl(found.place, slug),
      html: client.embedHtml(found.place, slug, { width: text(width), height: text(height) }),
    })
  })

  /* ----------------------------------------------------- the Solar System */

  const findBodyOrFail = async (
    verb: string,
    query: unknown
  ): Promise<{ body: SolarBody } | { error: ActionResult }> => {
    const body = await client.findBody(String(query ?? ""))
    return body ? { body } : { error: fail(verb, `No body of the Solar System matches "${query}".`) }
  }

  executor.register("find_body", async ({ query }) => {
    const found = await findBodyOrFail("find_body", query)
    return "error" in found ? found.error : ok("find_body", { body: found.body })
  })

  executor.register("list_bodies", async ({ kind, zone, orbits }) => {
    const bodies = await client.bodies({
      kind: text(kind) as BodyKind | undefined,
      zone: text(zone),
      orbits: text(orbits),
    })
    return ok("list_bodies", { bodies, count: bodies.length })
  })

  executor.register("get_body_song", async ({ body }) => {
    const found = await findBodyOrFail("get_body_song", body)
    if ("error" in found) return found.error
    const detail = await client.body(found.body.slug)
    if (!detail) return fail("get_body_song", `${found.body.name} has no song.`)
    return ok("get_body_song", detail)
  })

  executor.register("get_solar_system", async () => {
    const { edition, bodies } = await client.solarSystem()
    return ok("get_solar_system", { edition, bodies, count: bodies.length })
  })

  /* ------------------------------------------------------------- editions */

  executor.register("list_editions", async () => {
    const editions = await client.editions()
    return ok("list_editions", { editions, count: editions.length })
  })

  executor.register("get_edition", async ({ edition }) => {
    const slug = text(edition) ?? FOUNDING_EDITION
    const detail = await client.edition(slug)
    return detail ? ok("get_edition", detail) : fail("get_edition", `There is no edition "${slug}".`)
  })

  executor.register("get_geojson", async ({ edition }) => {
    const slug = text(edition) ?? FOUNDING_EDITION
    const geojson = await client.geojson(slug)
    return geojson ? ok("get_geojson", { geojson }) : fail("get_geojson", `There is no edition "${slug}".`)
  })
}

/** An OpenVerb executor with every Music Atlas verb registered and ready to run. */
export function createMusicAtlasExecutor(client: OpenMusicAtlas = atlas) {
  const executor = createExecutor(musicAtlasLibrary)
  registerMusicAtlasVerbs(executor, client)
  return executor
}
