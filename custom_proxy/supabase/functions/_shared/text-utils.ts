export interface TextMatch {
  value: string
  start: number
  end: number
}

export interface SensitiveEntry {
  value: string
}

/**
 * Removes overlapping matches, keeping the longest/most specific ones
 * @param matches - Array of text matches that may overlap
 * @returns Array of non-overlapping matches
 */
export function removeOverlappingMatches(matches: TextMatch[]): TextMatch[] {
  if (matches.length <= 1) return matches

  // Sort by start position, then by length (longest first for same start position)
  const sorted = matches.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    return b.end - b.start - (a.end - a.start) // Longer matches first
  })

  const nonOverlapping: TextMatch[] = []

  for (const match of sorted) {
    // Check if this match overlaps with any already accepted match
    const hasOverlap = nonOverlapping.some(
      (existing) =>
        !(match.end <= existing.start || match.start >= existing.end),
    )

    if (!hasOverlap) {
      nonOverlapping.push(match)
    }
  }

  return nonOverlapping
}

/**
 * Finds all occurrences of sensitive entities in the given text
 * @param text - The text to search in
 * @param sensitiveEntries - Array of sensitive entries to search for
 * @returns Array of non-overlapping matches found in the text
 *
 * @example
 * const entries = [{ sensitive_value: "John Doe", anonymized_value: "Person_1" }]
 * const matches = findSensitiveEntitiesInText("Hello John Doe", entries)
 * Returns: [{ sensitiveValue: "John Doe", anonymizedValue: "Person_1", start: 6, end: 14 }]
 */
export function findSensitiveEntitiesInText(
  text: string,
  sensitiveEntries: SensitiveEntry[],
): TextMatch[] {
  // If the text is empty, return empty array
  if (!text || text.trim() === '') {
    return []
  }

  // If no sensitive entries exist, return empty array
  if (!sensitiveEntries || sensitiveEntries.length === 0) {
    return []
  }

  // Sort entries by length (longest first) to prioritize longer matches
  const sortedEntries = sensitiveEntries.sort(
    (a, b) => b.value.length - a.value.length,
  )

  // Find all occurrences of sensitive values in the text
  const foundMatches: TextMatch[] = []

  for (const entry of sortedEntries) {
    const value = entry.value
    let searchStart = 0

    if (value.trim() === '') {
      continue
    }

    while (true) {
      const index = text.indexOf(value, searchStart)
      if (index === -1) break

      foundMatches.push({
        value: value,
        start: index,
        end: index + value.length,
      })

      searchStart = index + value.length
    }
  }

  // Remove overlapping matches
  return removeOverlappingMatches(foundMatches)
}
