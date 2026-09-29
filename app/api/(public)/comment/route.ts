import { withArticleCommentAccess } from '@/lib/core/blog-access/http'
import { GET as readComments, POST as createComment, DELETE as deleteComment } from './handlers'

export const dynamic = 'force-dynamic'
export const GET = withArticleCommentAccess(readComments)
export const POST = withArticleCommentAccess(createComment)
export const DELETE = deleteComment
