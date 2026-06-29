export interface ChatMessageView {
  id: string
  authorRole: string
  body: string
  createdAt: string
  authorName: string | null
  authorAvatarUrl: string | null
  editedAt?: string | null
  canEdit?: boolean
  isOwn?: boolean
}
