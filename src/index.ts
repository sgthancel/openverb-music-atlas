import type {
  AtlasFeatureCollection,
  ClientOptions,
  Edition,
  EditionDetail,
  EmbedOptions,
  Place,
  PlaceDetail,
  PlaceFilter,
} from "./types"

export type * from "./types"

/** The public home of the World Music Atlas. */
export const DEFAULT_BASE_URL = "https://openmusicatlas.org"

/** The first edition: the World Music Atlas — 2026 Founding Edition. */
export const FOUNDING_EDITION = "2026-founding"

/** The height, in pixels, at which the embeddable player fits without scrolling. */
export const EMBED_HEIGHT = 212

/** A failed request to the Open Music Atlas API. */
export class OpenMusicAtlasError extends Error {
  /** The HTTP status, e.g. 429 when rate-limited. */
  readonly status: number
  /** Seconds to wait before retrying, when the API says so. */
  readonly retryAfter: number | null

  constructor(message: string, status: number, retryAfter: number | null = null) {
    super(message)
    this.name = "OpenMusicAtlasError"
    this.status = status
    this.retryAfter = retryAfter
  }
}

type PlaceRef = string | Pick<Place, "slug">

/** Lower-case and strip accents, so "Côte d'Ivoire" matches "cote d'ivoire". */
const fold = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const slugOf = (place: PlaceRef) => (typeof place === "string" ? place : place.slug)

/**
 * A client for the Open Music Atlas API (v1).
 *
 * ```ts
 * import { atlas } from "@openverb/music-atlas"
 *
 * const jamaica = await atlas.country("Jamaica")
 * const song = await atlas.place("jamaica")
 * ```
 */
export class OpenMusicAtlas {
  readonly baseUrl: string
  private readonly customFetch?: typeof fetch
  private readonly headers: Record<string, string>
  private placesRequest: Promise<Place[]> | null = null

  constructor(options: ClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "")
    this.customFetch = options.fetch
    this.headers = { Accept: "application/json", ...options.headers }
  }

  /* ----------------------------------------------------------------- data */

  /**
   * Every place in the atlas, in listening order (continent, region, name).
   * Fetched once per client and then served from memory; pass a filter to
   * narrow it.
   */
  async places(filter: PlaceFilter = {}): Promise<Place[]> {
    if (!this.placesRequest) {
      this.placesRequest = this.request<{ places: Place[] }>("/api/v1/places").then((d) => d.places)
      // A failed load shouldn't be remembered.
      this.placesRequest.catch(() => (this.placesRequest = null))
    }
    const all = await this.placesRequest
    const continent = filter.continent ? fold(filter.continent) : null
    const region = filter.region ? fold(filter.region) : null
    return all.filter(
      (p) =>
        (!continent || fold(p.continent ?? "") === continent) &&
        (!region || fold(p.region ?? "") === region) &&
        (!filter.kind || p.kind === filter.kind)
    )
  }

  /** A place and its song in every published edition, or null if there is no such place. */
  async place(place: PlaceRef): Promise<PlaceDetail | null> {
    return this.request<PlaceDetail>(`/api/v1/places/${encodeURIComponent(slugOf(place))}`, { nullOn404: true })
  }

  /** Every published edition, newest first. */
  async editions(): Promise<Edition[]> {
    return (await this.request<{ editions: Edition[] }>("/api/v1/editions")).editions
  }

  /** An edition and all its songs in listening order, or null if there is no such edition. */
  async edition(slug: string = FOUNDING_EDITION): Promise<EditionDetail | null> {
    return this.request<EditionDetail>(`/api/v1/editions/${encodeURIComponent(slug)}`, { nullOn404: true })
  }

  /**
   * An edition as a GeoJSON FeatureCollection — one point per place, with the
   * place and its song as properties. Loads straight into Leaflet, MapLibre,
   * Mapbox, OpenLayers or QGIS.
   */
  async geojson(slug: string = FOUNDING_EDITION): Promise<AtlasFeatureCollection | null> {
    return this.request<AtlasFeatureCollection>(`/api/v1/editions/${encodeURIComponent(slug)}.geojson`, {
      nullOn404: true,
    })
  }

  /* -------------------------------------------------------------- finding */

  /**
   * One place by slug ("jamaica"), ISO code ("JM") or name ("Jamaica",
   * "cote d'ivoire"), or null. Case- and accent-insensitive; an exact match
   * wins over a name that merely starts with the query.
   */
  async find(query: string): Promise<Place | null> {
    const q = fold(query)
    if (!q) return null
    const all = await this.places()
    return (
      all.find((p) => p.slug === q) ??
      all.find((p) => p.isoCode !== null && p.isoCode.toLowerCase() === q) ??
      all.find((p) => fold(p.name) === q) ??
      all.find((p) => fold(p.name).startsWith(q)) ??
      null
    )
  }

  /** The same as find(), named for the common case: `atlas.country("Jamaica")`. */
  country(query: string): Promise<Place | null> {
    return this.find(query)
  }

  /** Places whose name contains the query, names starting with it first. */
  async search(query: string): Promise<Place[]> {
    const q = fold(query)
    if (!q) return []
    const all = await this.places()
    return all
      .filter((p) => fold(p.name).includes(q))
      .sort((a, b) => Number(!fold(a.name).startsWith(q)) - Number(!fold(b.name).startsWith(q)) || a.name.localeCompare(b.name))
  }

  /* --------------------------------------------------------------- embeds */

  /** The embeddable player's address for a place's song. No network request. */
  embedUrl(place: PlaceRef, edition: string = FOUNDING_EDITION): string {
    return `${this.baseUrl}/embed/${encodeURIComponent(slugOf(place))}/${encodeURIComponent(edition)}`
  }

  /** An `<iframe>` for the embeddable player, as HTML — for server rendering, templates and map popups. */
  embedHtml(place: PlaceRef, edition: string = FOUNDING_EDITION, options: EmbedOptions = {}): string {
    const a = this.embedAttributes(place, edition, options)
    return (
      `<iframe src="${escapeAttr(a.src)}" width="${escapeAttr(a.width)}" height="${escapeAttr(a.height)}"` +
      ` loading="${a.loading}" style="${a.style}" allow="${a.allow}" title="${escapeAttr(a.title)}"></iframe>`
    )
  }

  /** An `<iframe>` element for the embeddable player, ready to append. Browser only. */
  createEmbed(place: PlaceRef, edition: string = FOUNDING_EDITION, options: EmbedOptions = {}): HTMLIFrameElement {
    if (typeof document === "undefined") {
      throw new Error("createEmbed() needs a browser. On the server, use embedHtml().")
    }
    const a = this.embedAttributes(place, edition, options)
    const frame = document.createElement("iframe")
    frame.src = a.src
    frame.width = a.width
    frame.height = a.height
    frame.loading = a.loading
    frame.setAttribute("style", a.style)
    frame.allow = a.allow
    frame.title = a.title
    return frame
  }

  private embedAttributes(place: PlaceRef, edition: string, options: EmbedOptions) {
    const name = typeof place === "string" ? place : "name" in place ? String((place as Place).name) : place.slug
    return {
      src: this.embedUrl(place, edition),
      width: String(options.width ?? "100%"),
      height: String(options.height ?? EMBED_HEIGHT),
      loading: options.loading ?? "lazy",
      style: "border:0;border-radius:12px",
      allow: "autoplay; encrypted-media",
      title: options.title ?? `${name} — World Music Atlas`,
    }
  }

  /* -------------------------------------------------------------- transport */

  private async request<T>(path: string): Promise<T>
  private async request<T>(path: string, options: { nullOn404: true }): Promise<T | null>
  private async request<T>(path: string, options: { nullOn404?: boolean } = {}): Promise<T | null> {
    const fetcher = this.customFetch ?? (globalThis as { fetch?: typeof fetch }).fetch
    if (typeof fetcher !== "function") {
      throw new Error("No fetch is available. Use Node 18 or later, or pass `fetch` in the client options.")
    }

    const res = await fetcher(`${this.baseUrl}${path}`, { headers: this.headers })
    if (res.status === 404 && options.nullOn404) return null
    if (!res.ok) {
      let message = `Open Music Atlas API responded with ${res.status}`
      try {
        const body = (await res.json()) as { error?: string }
        if (body?.error) message = body.error
      } catch {
        // Not JSON; keep the generic message.
      }
      const retry = res.headers.get("retry-after")
      throw new OpenMusicAtlasError(message, res.status, retry !== null && retry !== "" ? Number(retry) : null)
    }
    return (await res.json()) as T
  }
}

/** A ready-made client for https://openmusicatlas.org. */
export const atlas = new OpenMusicAtlas()
