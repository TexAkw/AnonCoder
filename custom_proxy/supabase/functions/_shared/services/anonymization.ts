export function generateAnonymizedValue(label: string): string {
  const id = crypto.randomUUID()
  const shortId = id.slice(0, 4).toUpperCase()
  const sanitizedLabel = label.toUpperCase().replace(/\s+/g, '-')
  return `${sanitizedLabel}-${shortId}`
}
