export type AddSensitiveEntriesRequest = {
  words: { value: string }[]
}

export type SensitiveEntryResponse = {
  id: string
  sensitiveValue: string
  anonymizedValue: string
  label: string
}

export type AddSensitiveEntriesResponse = {
  results: SensitiveEntryResponse[]
}

export type RemoveSensitiveEntriesRequest = {
  ids: string[]
}

export type RemoveSensitiveEntriesResponse = {
  deletedIds: string[]
}

export type AnalyzeMessageRequest = {
  message: string
}

export type AnalyzeMessageResponse = {
  results: SensitiveEntryResponse[]
}

export type AnonymizeMessageRequest = {
  message: string
  entryIds: string[]
  customWords?: string[]
}

export type AnonymizeMessageResponse = {
  message: string
  newlyCreatedEntries: SensitiveEntryResponse[]
}

export type GetEntitiesCategoriesResponse = {
  entitiesCategories: {
    en: string
    fr: string
    bgColor: string
    textColor: string
    labels: string[]
  }[]
}

export type GetSensitiveEntriesResponse = {
  sensitiveEntries: SensitiveEntryResponse[]
}

/**
 * Response format
 */
export interface FunctionsResponseSuccess<T> {
  data: T
  error: null
}

export interface FunctionsResponseFailure {
  data: null
  error: unknown
}
export type FunctionsResponse<T> =
  | FunctionsResponseSuccess<T>
  | FunctionsResponseFailure