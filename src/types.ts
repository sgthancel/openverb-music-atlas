/**
 * The shapes of the Open Music Atlas API, v1.
 *
 * v1 is a stable contract: fields may be added, never removed or renamed.
 * Responses carry Open Music Atlas URLs and descriptive metadata only — no
 * internal database ids, no provider identifiers and no audio files. Songs
 * are heard through the embeddable player (`embedUrl`).
 */

/** What kind of place a record is. "place" is used where classification itself is contested. */
export type PlaceKind = "country" | "territory" | "continent" | "place" | "city" | "region" | "landmark"

/** A place in the atlas. Places are permanent; each edition gives a place a song. */
export interface Place {
  /** Stable identifier, e.g. "jamaica". */
  slug: string
  name: string
  /** ISO 3166-1 alpha-2 code where one applies, e.g. "JM". */
  isoCode: string | null
  kind: PlaceKind
  /** UN M49 continent, e.g. "Americas". */
  continent: string | null
  /** UN M49 region, e.g. "Caribbean". */
  region: string | null
  /** A representative point, [longitude, latitude]. */
  coordinates: [number, number] | null
  /** Disputed or partially recognised. Inclusion is not a statement about sovereignty. */
  isDisputed: boolean
  /** The place's page on Open Music Atlas. */
  pageUrl: string
}

/** A published edition of the atlas, e.g. the 2026 Founding Edition. */
export interface Edition {
  slug: string
  name: string
  /** The collection it belongs to, e.g. "world-music-atlas". */
  collection: string
  year: number
  version: number
  /** The artistic constraint for the whole edition, if any. */
  styleConstraint: string | null
  /** When the edition was frozen (ISO 8601). A frozen edition's songs never change. */
  frozenAt: string | null
  entryCount: number
  pageUrl: string
}

/** The edition an entry belongs to, as it appears alongside a place. */
export interface EditionRef {
  slug: string
  name: string
  year: number
  version: number
  frozenAt: string | null
}

/** A place's song in one edition. */
export interface Entry {
  title: string
  description: string | null
  /** The song's musical style. */
  style: string | null
  curatorsSelection: boolean
  /** The place's page on Open Music Atlas. */
  pageUrl: string
  /** The embeddable player for this song. */
  embedUrl: string
}

/** A place and its song in every published edition. */
export interface PlaceDetail {
  place: Place
  entries: { edition: EditionRef; entry: Entry }[]
}

/** An edition and every song in it, in listening order. */
export interface EditionDetail {
  edition: Edition
  entries: { place: Place; entry: Entry }[]
}

/** The properties of one point in an edition's GeoJSON. */
export interface AtlasFeatureProperties {
  slug: string
  name: string
  isoCode: string | null
  kind: PlaceKind
  continent: string | null
  region: string | null
  isDisputed: boolean
  /** The edition's slug. */
  edition: string
  title: string
  description: string | null
  style: string | null
  curatorsSelection: boolean
  pageUrl: string
  embedUrl: string
}

export interface AtlasFeature {
  type: "Feature"
  id: string
  geometry: { type: "Point"; coordinates: [number, number] }
  properties: AtlasFeatureProperties
}

/** An edition as a GeoJSON FeatureCollection: one point per place. */
export interface AtlasFeatureCollection {
  type: "FeatureCollection"
  name: string
  edition: Edition
  features: AtlasFeature[]
}

/* ------------------------------------------------------- the Solar System */

/** What kind of thing a body of the Solar System is. */
export type BodyKind = "star" | "planet" | "moon" | "dwarf-planet" | "region" | "comet" | "spacecraft"

/** One body of the Solar System, with the song written for it. */
export interface SolarBody {
  /** Stable identifier, e.g. "europa". */
  slug: string
  name: string
  kind: BodyKind
  /** Where it sits, e.g. "Inner System", "Kuiper Belt". */
  zone: string | null
  /** The body it goes round, e.g. "Jupiter" for Europa. Null for the Sun and the planets. */
  orbits: string | null
  title: string
  description: string | null
  /** The song's musical style. */
  style: string | null
  /** The established astronomy the song was written from. */
  facts: string[]
  /** How many takes were kept. One for all but a few. */
  takes: number
  /** The body's page on Open Music Atlas. */
  pageUrl: string
  /** The embeddable player for its song. */
  embedUrl: string
}

/** The Solar System edition. */
export interface SolarEdition {
  slug: string
  name: string
  collection: string
  year: number
  version: number
  styleConstraint: string | null
  description: string | null
  /** When the edition was frozen (ISO 8601). A frozen edition's songs never change. */
  frozenAt: string | null
  pageUrl: string
}

/** The whole collection: the edition and every body, outward from the Sun. */
export interface SolarCollection {
  collection: string
  edition: SolarEdition | null
  count: number
  bodies: SolarBody[]
}

/** A body by name, as it appears beside another. */
export interface BodyRef {
  slug: string
  name: string
}

/** One body, with what it orbits and what orbits it. */
export interface SolarBodyDetail {
  body: SolarBody
  edition: { slug: string; name: string; year: number; frozenAt: string | null }
  /** What this body goes round, when it is a moon. */
  orbits: BodyRef | null
  /** What goes round this body. */
  satellites: BodyRef[]
  /** The labels of the takes kept, when more than one was. */
  takes: string[]
}

export interface BodyFilter {
  kind?: BodyKind
  /** Where it sits, e.g. "Outer System" (case-insensitive). */
  zone?: string
  /** What it goes round, e.g. "Jupiter" (case-insensitive). */
  orbits?: string
}

export interface ClientOptions {
  /** Defaults to https://openmusicatlas.org. */
  baseUrl?: string
  /** A fetch implementation. Defaults to the global fetch (Node 18+, browsers, Deno, Bun). */
  fetch?: typeof fetch
  /** Extra headers sent with every request. */
  headers?: Record<string, string>
}

export interface PlaceFilter {
  /** UN M49 continent, e.g. "Africa" (case-insensitive). */
  continent?: string
  /** UN M49 region, e.g. "Caribbean" (case-insensitive). */
  region?: string
  kind?: PlaceKind
}

export interface EmbedOptions {
  /** Defaults to "100%". */
  width?: number | string
  /** Defaults to 212, which fits the player without scrolling. */
  height?: number | string
  /** The frame's accessible title. Defaults to "<place> — World Music Atlas". */
  title?: string
  /** Defaults to "lazy". */
  loading?: "lazy" | "eager"
}
