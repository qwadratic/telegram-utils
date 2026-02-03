import type { Message, User, Chat, PeerSender } from '@mtcute/node'
import { md } from '@mtcute/markdown-parser'

/**
 * Format a sender for display in Markdown.
 *
 * Handles:
 * - Anonymous senders: returns displayName
 * - Users: returns "FirstName LastName (@username)" or just name if no username
 * - Chats (channel posts): returns title
 *
 * @param sender - The sender to format
 * @returns Formatted sender string
 */
export function formatSender(sender: User | Chat | PeerSender): string {
  // Handle anonymous senders (users with hidden forwards)
  if ('type' in sender && sender.type === 'anonymous') {
    return (sender as { displayName: string }).displayName
  }

  // Handle users
  if ('firstName' in sender) {
    const user = sender as User
    const name = user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName
    return user.username ? `${name} (@${user.username})` : name
  }

  // Handle chats (channels, groups)
  if ('title' in sender) {
    return (sender as Chat).title
  }

  // Fallback for any other type with displayName
  if ('displayName' in sender) {
    return (sender as { displayName: string }).displayName
  }

  return 'Unknown'
}

/**
 * Format a message date as YYYY-MM-DD HH:MM:SS
 */
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * Format a Telegram message to Markdown.
 *
 * Output format:
 * ```
 * **[YYYY-MM-DD HH:MM:SS]** **Sender Name (@username)** [id:123]
 *
 * > Forwarded from: Source Name
 *
 * > In reply to [id:456]: "First 100 chars of original..."
 *
 * [Attachment: photo]
 *
 * Message text with **formatting** preserved
 *
 * ---
 * ```
 *
 * @param msg - The Telegram message to format
 * @returns Formatted Markdown string
 */
export function formatMessage(msg: Message): string {
  const timestamp = formatDate(msg.date)
  const sender = formatSender(msg.sender)

  // Header line with timestamp, sender, and message ID
  let output = `**[${timestamp}]** **${sender}** [id:${msg.id}]\n\n`

  // Handle forwards
  if (msg.forward) {
    const fwdSender = msg.forward.sender
    const fwdName = formatSender(fwdSender)
    output += `> Forwarded from: ${fwdName}\n\n`
  }

  // Handle replies with quote
  if (msg.replyToMessage) {
    const replyId = msg.replyToMessage.id
    const quoteText = msg.replyToMessage.quoteText || ''

    if (replyId !== null) {
      // Truncate quote to 100 chars
      const truncatedQuote =
        quoteText.length > 100 ? `${quoteText.slice(0, 100)}...` : quoteText

      if (truncatedQuote) {
        // Escape quote text for Markdown blockquote (replace newlines)
        const escapedQuote = truncatedQuote.replace(/\n/g, ' ')
        output += `> In reply to [id:${replyId}]: "${escapedQuote}"\n\n`
      } else {
        output += `> In reply to [id:${replyId}]\n\n`
      }
    }
  }

  // Handle attachments (media)
  if (msg.media) {
    const mediaType = msg.media.type
    output += `[Attachment: ${mediaType}]\n\n`
  }

  // Message text with entities converted to Markdown
  const text = md.unparse(msg.textWithEntities)
  if (text) {
    output += `${text}\n\n`
  }

  output += '---\n\n'

  return output
}
