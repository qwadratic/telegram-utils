export type RecencyMode = 'recent' | 'historical'

export type MessageBlock = {
  text: string
  timestamp: Date | null
}

export type ParsedSection = {
  header: string
  blocks: MessageBlock[]
}
