import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  ChevronUp,
  CircleSlash2,
  Flag,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Send,
  ShieldCheck,
  ShoppingBag,
  ThumbsDown,
  Trash2,
  UserMinus,
  UserPlus,
  VolumeX,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import ImageLightbox from '@/components/ImageLightbox'
import {
  createComment,
  deleteComment,
  deleteContent,
  getContentDetail,
  reportTarget,
  shareContent,
  toggleFavorite,
  toggleFollow,
  toggleReaction,
  toggleUserModeration,
} from '@/api/marketplace'
import { cn } from '@/lib/utils'

const TYPE_LABELS = { listing: '二手', game: '游戏交易', service: '跑腿任务', wanted: '求购', community: '校园社区' }

function timeLabel(value) {
  if (!value) return '刚刚'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚'
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function mapCommentTree(comments, commentId, updater) {
  return comments.map((comment) => {
    if (comment.id === commentId) return updater(comment)
    if (comment.replies?.length) return { ...comment, replies: mapCommentTree(comment.replies, commentId, updater) }
    return comment
  })
}

function appendCommentReply(comments, parentId, reply) {
  return comments.map((comment) => {
    if (comment.id === parentId) return { ...comment, replies: [...(comment.replies || []), reply] }
    if (comment.replies?.length) return { ...comment, replies: appendCommentReply(comment.replies, parentId, reply) }
    return comment
  })
}

function removeComments(comments, removedIds) {
  const ids = new Set(removedIds)
  return comments.filter((comment) => !ids.has(comment.id)).map((comment) => ({
    ...comment,
    replies: removeComments(comment.replies || [], removedIds),
  }))
}

function CommentNode({ comment, onReply, onReact, onDelete, onOpenUser, depth = 0 }) {
  const [replying, setReplying] = useState(false)
  const [text, setText] = useState('')
  const [expanded, setExpanded] = useState(true)
  const author = comment.author || {}

  return (
    <article className="x-comment" style={{ '--depth': depth }}>
      <button type="button" className="x-comment-avatar" onClick={() => onOpenUser?.(author.id)}>
        <Avatar className="size-10"><AvatarImage src={author.avatar_url || undefined} alt={author.nickname || author.username} /><AvatarFallback>{(author.nickname || author.username || '同').slice(0, 1)}</AvatarFallback></Avatar>
      </button>
      <div className="x-comment-body">
        <div className="x-comment-meta"><button type="button" onClick={() => onOpenUser?.(author.id)}>{author.nickname || author.username || '校园同学'}</button><span>@{author.username || 'campus'} · {timeLabel(comment.created_at)}</span>{comment.can_delete ? <button type="button" className="x-comment-delete" onClick={() => onDelete(comment)} aria-label="删除评论"><Trash2 /></button> : null}</div>
        <p>{comment.content}</p>
        <div className="x-comment-actions">
          <button type="button" onClick={() => setReplying((value) => !value)}><MessageCircle /> {comment.replies?.length || 0}</button>
          <button type="button" className={cn(comment.reaction === 'like' && 'is-like')} onClick={() => onReact('comment', comment.id, 'like')} aria-pressed={comment.reaction === 'like'}><Heart className={cn(comment.reaction === 'like' && 'fill-current')} /> {comment.likes || 0}</button>
          <button type="button" className={cn(comment.reaction === 'dislike' && 'is-dislike')} onClick={() => onReact('comment', comment.id, 'dislike')}><ThumbsDown /> {comment.dislikes || 0}</button>
          {comment.replies?.length ? <button type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? <ChevronUp /> : <ChevronDown />}{expanded ? '收起' : '展开'}</button> : null}
        </div>
        {replying ? <div className="x-comment-reply"><Textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={`回复 ${author.nickname || author.username || '这位同学'}...`} /><div><Button size="sm" onClick={async () => { if (!text.trim()) return; await onReply(text, comment.id); setText(''); setReplying(false) }}><Send /> 回复</Button><Button size="sm" variant="ghost" onClick={() => setReplying(false)}>取消</Button></div></div> : null}
        {expanded && comment.replies?.length ? <div className="x-comment-children">{comment.replies.map((reply) => <CommentNode key={reply.id} comment={reply} onReply={onReply} onReact={onReact} onDelete={onDelete} onOpenUser={onOpenUser} depth={depth + 1} />)}</div> : null}
      </div>
    </article>
  )
}

export default function ContentDetail({
  target,
  currentUser,
  onBack,
  onNotice,
  onOpenTarget,
  onOpenUser,
  onTopic,
  onMessage,
  onPurchase,
  onDeleted,
  onItemChange,
  onFeedRefresh,
}) {
  const [detail, setDetail] = useState(null)
  const [comment, setComment] = useState('')
  const [shareText, setShareText] = useState('')
  const [shareOpen, setShareOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('疑似欺诈交易')
  const [loading, setLoading] = useState(true)
  const [reactBurst, setReactBurst] = useState('')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const loadDetail = useCallback(async () => {
    if (!target?.id || !target?.type) return
    setLoading(true)
    try {
      setDetail(await getContentDetail(target.type, target.id))
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '详情加载失败')
    } finally {
      setLoading(false)
    }
  }, [target?.id, target?.type, onNotice])

  useEffect(() => { loadDetail() }, [loadDetail])

  const item = detail?.item
  const author = item?.author || {}

  const pushItemChange = (patch) => {
    if (!item?.id || !item?.type) return
    onItemChange?.({
      type: item.type,
      id: item.id,
      ...patch,
    })
  }

  const react = async (targetType, targetId, reactionType) => {
    try {
      const response = await toggleReaction({ target_type: targetType, target_id: targetId, reaction_type: reactionType })
      setReactBurst(`${targetType}-${targetId}-${reactionType}-${Date.now()}`)
      setDetail((current) => {
        if (targetType === 'comment') {
          return { ...current, comments: mapCommentTree(current.comments || [], targetId, (node) => ({ ...node, likes: response.likes, dislikes: response.dislikes, reaction: response.my_reaction })) }
        }
        const reaction = {
          likes: response.likes,
          dislikes: response.dislikes,
          my_reaction: response.my_reaction,
        }
        const nextItem = { ...current.item, reaction, like_count: reaction.likes, dislike_count: reaction.dislikes }
        return { ...current, item: nextItem }
      })
      if (targetType !== 'comment') {
        const reaction = {
          likes: response.likes,
          dislikes: response.dislikes,
          my_reaction: response.my_reaction,
        }
        pushItemChange({ reaction, like_count: reaction.likes, dislike_count: reaction.dislikes })
      }
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '操作失败')
    }
  }

  const submitComment = async (content, parentId = null) => {
    try {
      const response = await createComment({ target_type: item.type, target_id: item.id, content, parent_id: parentId })
      setComment('')
      const nextCount = (item.comment_count || 0) + 1
      setDetail((current) => ({
        ...current,
        item: { ...current.item, comment_count: nextCount },
        comments: parentId ? appendCommentReply(current.comments || [], parentId, response.comment) : [...(current.comments || []), response.comment],
      }))
      pushItemChange({ comment_count: nextCount })
      onNotice?.('留言成功')
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '留言失败')
    }
  }

  const removeComment = async (node) => {
    if (!window.confirm('确定删除这条评论吗？它下面的回复也会一起删除。')) return
    try {
      const response = await deleteComment(node.id)
      const removed = response.removed_ids || [node.id]
      const nextCount = Math.max(0, (item.comment_count || 0) - removed.length)
      setDetail((current) => ({
        ...current,
        item: { ...current.item, comment_count: nextCount },
        comments: removeComments(current.comments || [], removed),
      }))
      pushItemChange({ comment_count: nextCount })
      onNotice?.(response.message)
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '评论删除失败')
    }
  }

  const share = async () => {
    try {
      const response = await shareContent({ source_type: item.type, source_id: item.id, comment: shareText })
      setShareText('')
      setShareOpen(false)
      const nextRepost = (item.repost_count || 0) + 1
      setDetail((current) => ({ ...current, item: { ...current.item, repost_count: nextRepost } }))
      pushItemChange({ repost_count: nextRepost })
      onFeedRefresh?.()
      onNotice?.(response.message || '已转发到校园社区')
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '转发失败')
    }
  }

  const favorite = async () => {
    try {
      const response = await toggleFavorite(item.type, item.id)
      setDetail((current) => ({ ...current, item: { ...current.item, favorited: response.favorited } }))
      pushItemChange({ favorited: response.favorited })
      onNotice?.(response.message)
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '收藏失败')
    }
  }

  const follow = async () => {
    try {
      const response = await toggleFollow(author.id)
      setDetail((current) => ({ ...current, item: { ...current.item, author: { ...current.item.author, is_following: response.followed } } }))
      onItemChange?.({
        type: item.type,
        id: item.id,
        author: { ...(item.author || {}), is_following: response.followed },
        _authorFollow: { userId: author.id, followed: response.followed },
      })
      onNotice?.(response.message)
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '关注失败')
    }
  }

  const moderate = async (action) => {
    try {
      const response = await toggleUserModeration(action, author.id)
      const flag = action === 'mute' ? 'is_muted' : 'is_blocked'
      setDetail((current) => ({ ...current, item: { ...current.item, author: { ...current.item.author, [flag]: response.enabled } } }))
      onItemChange?.({
        type: item.type,
        id: item.id,
        author: { ...(item.author || {}), [flag]: response.enabled },
        _hideAuthorId: response.enabled ? author.id : null,
      })
      onNotice?.(response.message)
      if (response.enabled) onFeedRefresh?.()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '操作失败')
    }
  }

  const report = async () => {
    try {
      const response = await reportTarget({ target_type: item.type, target_id: item.id, reason: reportReason })
      setReportOpen(false)
      onNotice?.(response.message)
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '举报提交失败')
    }
  }

  const remove = async () => {
    if (!window.confirm('确定删除这条发布吗？删除后评论和点赞也会一起清理。')) return
    try {
      const response = await deleteContent(item.type, item.id)
      onNotice?.(response.message || '已删除发布内容')
      onDeleted?.()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '删除失败')
    }
  }

  if (loading) return <div className="x-detail-page"><div className="chat-empty">详情加载中...</div></div>
  if (!item) return <div className="x-detail-page"><Button variant="ghost" onClick={onBack}><ArrowLeft /> 返回</Button><div className="chat-empty">内容不存在</div></div>

  const isTrade = item.type !== 'community'

  return (
    <div className="x-detail-page">
      <header className="x-detail-topbar"><Button variant="ghost" size="icon" onClick={onBack} aria-label="返回"><ArrowLeft /></Button><div><strong>帖子</strong><span>{TYPE_LABELS[item.type] || '校园内容'}</span></div></header>
      <article className="x-post">
        <div className="x-post-author-row">
          <button type="button" className="x-post-author" onClick={() => onOpenUser?.(author.id)}>
            <Avatar className="size-12"><AvatarImage src={author.avatar_url || undefined} alt={author.nickname || author.username} /><AvatarFallback>{(author.nickname || author.username || '同').slice(0, 1)}</AvatarFallback></Avatar>
            <span><strong>{author.nickname || author.username || '校园同学'}<i className={author.is_online ? 'presence-dot is-online' : 'presence-dot'} /></strong><small>@{author.username || 'campus'} · {timeLabel(item.created_at)}</small></span>
          </button>
          <div className="x-post-author-actions">
            {item.can_message ? <Button variant="outline" size="sm" onClick={() => onMessage?.(item)}><MessageCircle /> 私信</Button> : null}
            {!item.can_delete ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="更多操作"><MoreHorizontal /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="x-post-menu">
                  <DropdownMenuItem onClick={follow}>{author.is_following ? <UserMinus /> : <UserPlus />}{author.is_following ? '取消关注' : '关注'}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => moderate('mute')}><VolumeX />{author.is_muted ? '取消屏蔽' : '屏蔽此用户'}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => moderate('block')}><CircleSlash2 />{author.is_blocked ? '取消拉黑' : '拉黑此用户'}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setReportOpen(true)}><Flag /> 举报</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : <Button variant="ghost" size="icon" className="is-danger" onClick={remove} aria-label="删除发布"><Trash2 /></Button>}
          </div>
        </div>

        <div className="x-post-copy">
          <h1>{item.title}</h1>
          <p>{item.description}</p>
          {item.status && item.type === 'community' ? <button type="button" className="x-topic-tag" onClick={() => onTopic?.(item.status)}>#{item.status}</button> : null}
        </div>

        {item.images?.length ? (
          <div className={cn('x-post-images', item.images.length === 1 && 'is-single')}>
            {item.images.map((image, index) => (
              <button
                key={`${image.slice(0, 24)}-${index}`}
                type="button"
                className="x-post-image-btn"
                onClick={() => { setLightboxIndex(index); setLightboxOpen(true) }}
                aria-label={`查看第 ${index + 1} 张大图`}
              >
                <img src={image} alt="" />
                <span className="x-post-image-hint">点击查看大图</span>
              </button>
            ))}
          </div>
        ) : null}
        {item.source ? <button type="button" className="x-source-post" onClick={() => onOpenTarget?.({ type: item.source.type, id: item.source.id })}><Repeat2 /><span><small>转发自原内容</small><strong>{item.source.title}</strong></span></button> : null}

        <div className="x-post-context"><span><ShieldCheck /> 信任 {author.trust?.score ?? 800} · {item.school || '南通理工学院'} · {item.location || '校内'}</span>{isTrade && item.price_label ? <strong>{item.price_label}</strong> : null}</div>
        {isTrade && !item.can_delete ? <Button className="x-purchase-button" onClick={() => onPurchase?.(item)}><ShoppingBag />{item.type === 'service' ? '立即接单' : item.type === 'wanted' ? '响应求购' : '立即购买'}</Button> : null}

        <div className="x-post-actions">
          <button type="button" onClick={() => document.querySelector('.x-reply-composer textarea')?.focus()}><MessageCircle /> <span>{item.comment_count || 0}</span></button>
          <button type="button" onClick={() => setShareOpen((value) => !value)}><Repeat2 /> <span>{item.repost_count || 0}</span></button>
          <button
            type="button"
            className={cn(item.reaction?.my_reaction === 'like' && 'is-like', reactBurst.startsWith(`${item.type}-${item.id}-like`) && 'is-burst')}
            onClick={() => react(item.type, item.id, 'like')}
            aria-pressed={item.reaction?.my_reaction === 'like'}
          >
            <Heart className={cn(item.reaction?.my_reaction === 'like' && 'fill-current')} />
            <span>{item.reaction?.likes || item.like_count || 0}</span>
          </button>
          <button type="button" className={cn(item.reaction?.my_reaction === 'dislike' && 'is-dislike')} onClick={() => react(item.type, item.id, 'dislike')}><ThumbsDown /> <span>{item.reaction?.dislikes || 0}</span></button>
          <button type="button" className={cn(item.favorited && 'is-saved')} onClick={favorite}><Bookmark className={cn(item.favorited && 'fill-current')} /></button>
        </div>
        {shareOpen ? <div className="x-share-composer"><Textarea value={shareText} onChange={(event) => setShareText(event.target.value)} placeholder="添加你的转发评论，也可以直接转发..." /><Button onClick={share}><Repeat2 /> 转发到校园社区</Button></div> : null}
      </article>

      <section className="x-replies">
        <div className="x-reply-composer">
          <Avatar className="size-10"><AvatarImage src={currentUser?.profile?.avatar_url || undefined} alt={currentUser?.profile?.nickname || currentUser?.username} /><AvatarFallback>{(currentUser?.profile?.nickname || currentUser?.username || '我').slice(0, 1)}</AvatarFallback></Avatar>
          <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="发布你的回复" />
          <Button onClick={() => submitComment(comment)} disabled={!comment.trim()}>回复</Button>
        </div>
        <div className="x-comment-list">{detail.comments?.length ? detail.comments.map((node) => <CommentNode key={node.id} comment={node} onReply={submitComment} onReact={react} onDelete={removeComment} onOpenUser={onOpenUser} />) : <div className="chat-empty">还没有评论，来发布第一条回复。</div>}</div>
      </section>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="x-report-dialog"><DialogHeader><DialogTitle>举报这条内容</DialogTitle><DialogDescription>举报会进入平台核实流程，未核实前不会直接扣除对方信任分。</DialogDescription></DialogHeader><div className="x-report-options">{['疑似欺诈交易', '违规商品或服务', '骚扰或辱骂', '垃圾广告', '其他问题'].map((reason) => <button key={reason} type="button" className={reportReason === reason ? 'is-active' : ''} onClick={() => setReportReason(reason)}><Flag /> {reason}</button>)}</div><DialogFooter><Button variant="outline" onClick={() => setReportOpen(false)}>取消</Button><Button variant="destructive" onClick={report}>提交举报</Button></DialogFooter></DialogContent>
      </Dialog>

      <ImageLightbox
        open={lightboxOpen}
        images={item.images || []}
        index={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setLightboxIndex}
      />
    </div>
  )
}
