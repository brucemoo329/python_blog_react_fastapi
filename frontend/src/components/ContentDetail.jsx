import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Heart,
  MessageSquare,
  Reply,
  Share2,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { createComment, getContentDetail, shareContent, toggleReaction } from '@/api/marketplace'
import { cn } from '@/lib/utils'

function timeLabel(value) {
  if (!value) return '刚刚'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚'
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function CommentNode({ comment, target, onReply, onReact, onOpenSource, depth = 0 }) {
  const [replying, setReplying] = useState(false)
  const [text, setText] = useState('')
  const [expanded, setExpanded] = useState(true)
  const author = comment.author || {}

  return (
    <div className="detail-comment-node" style={{ '--depth': depth }}>
      <Card className="detail-comment-card">
        <CardContent>
          <Avatar className="size-8">
            <AvatarImage src={author.avatar_url || undefined} alt={author.nickname || author.username} />
            <AvatarFallback>{(author.nickname || author.username || '同').slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="detail-comment-main">
            <div className="detail-comment-meta">
              <strong>{author.nickname || author.username || '校园同学'}</strong>
              <span>{timeLabel(comment.created_at)}</span>
              {depth === 0 ? <Badge variant="outline">留言</Badge> : null}
            </div>
            <p>{comment.content}</p>
            <div className="detail-comment-actions">
              <button type="button" className={cn(comment.reaction === 'like' && 'is-like')} onClick={() => onReact('comment', comment.id, 'like')}>
                <ThumbsUp /> {comment.likes || 0}
              </button>
              <button type="button" className={cn(comment.reaction === 'dislike' && 'is-dislike')} onClick={() => onReact('comment', comment.id, 'dislike')}>
                <ThumbsDown /> {comment.dislikes || 0}
              </button>
              <button type="button" onClick={() => setReplying((value) => !value)}><Reply /> 回复</button>
              {comment.replies?.length ? (
                <button type="button" onClick={() => setExpanded((value) => !value)}>
                  {expanded ? <ChevronUp /> : <ChevronDown />} {expanded ? '收起' : `展开 ${comment.replies.length}`}
                </button>
              ) : null}
            </div>
            {replying ? (
              <div className="detail-reply-box">
                <Textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="回复这条留言..." />
                <div>
                  <Button size="sm" onClick={async () => {
                    if (!text.trim()) return
                    await onReply(text, comment.id)
                    setText('')
                    setReplying(false)
                  }}>发送回复</Button>
                  <Button size="sm" variant="outline" onClick={() => setReplying(false)}>取消</Button>
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
      {expanded && comment.replies?.length ? (
        <div className="detail-comment-children">
          {comment.replies.map((reply) => (
            <CommentNode key={reply.id} comment={reply} target={target} onReply={onReply} onReact={onReact} onOpenSource={onOpenSource} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function ContentDetail({ target, onBack, onNotice, onOpenTarget }) {
  const [detail, setDetail] = useState(null)
  const [comment, setComment] = useState('')
  const [shareText, setShareText] = useState('')
  const [loading, setLoading] = useState(true)
  const [reactBurst, setReactBurst] = useState('')

  const loadDetail = async () => {
    if (!target?.id || !target?.type) return
    setLoading(true)
    try {
      const response = await getContentDetail(target.type, target.id)
      setDetail(response)
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '详情加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDetail()
  }, [target?.type, target?.id])

  const item = detail?.item
  const author = item?.author || {}

  const react = async (targetType, targetId, reactionType) => {
    try {
      await toggleReaction({ target_type: targetType, target_id: targetId, reaction_type: reactionType })
      setReactBurst(`${targetType}-${targetId}-${reactionType}-${Date.now()}`)
      loadDetail()
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '操作失败')
    }
  }

  const submitComment = async (content, parentId = null) => {
    try {
      await createComment({
        target_type: item.type,
        target_id: item.id,
        content,
        parent_id: parentId,
      })
      setComment('')
      loadDetail()
      onNotice?.('留言成功')
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '留言失败')
    }
  }

  const share = async () => {
    try {
      const response = await shareContent({
        source_type: item.type,
        source_id: item.id,
        comment: shareText,
      })
      setShareText('')
      onNotice?.(response.message || '已转发到校园社区')
      onOpenTarget?.({ type: response.type, id: response.id })
    } catch (error) {
      onNotice?.(error.response?.data?.detail || '转发失败')
    }
  }

  if (loading) {
    return <div className="detail-page"><Card className="detail-card"><CardContent>详情加载中...</CardContent></Card></div>
  }

  if (!item) {
    return <div className="detail-page"><Card className="detail-card"><CardContent>内容不存在</CardContent></Card></div>
  }

  return (
    <div className="detail-page">
      <Button variant="ghost" className="detail-back" onClick={onBack}><ArrowLeft /> 返回</Button>
      <Card className="detail-card detail-hero-card">
        <CardHeader>
          <div>
            <Badge variant="secondary">{item.type}</Badge>
            <CardTitle>{item.title}</CardTitle>
          </div>
          <strong className="detail-price">{item.price_label}</strong>
        </CardHeader>
        <CardContent>
          <div className="detail-author">
            <Avatar className="size-12">
              <AvatarImage src={author.avatar_url || undefined} alt={author.nickname || author.username} />
              <AvatarFallback>{(author.nickname || author.username || '同').slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div>
              <strong>{author.nickname || author.username || '校园同学'}</strong>
              <span>
                <ShieldCheck />
                信任{author.trust?.grade || '优秀'} {author.trust?.score ?? 800} · {item.school || '校园同学'} · {item.location || '校内'}
              </span>
            </div>
          </div>

          {item.images?.length ? (
            <div className="detail-image-grid">
              {item.images.map((image, index) => <img key={`${image.slice(0, 20)}-${index}`} src={image} alt="" />)}
            </div>
          ) : null}

          <p className="detail-description">{item.description}</p>

          {item.source ? (
            <button type="button" className="detail-source-card" onClick={() => onOpenTarget?.({ type: item.source.type, id: item.source.id })}>
              <Share2 /> 原内容：{item.source.title}
            </button>
          ) : null}

          <div className="detail-actions">
            <button
              type="button"
              className={cn(item.reaction?.my_reaction === 'like' && 'is-like', reactBurst.includes(`${item.type}-${item.id}-like`) && 'is-burst')}
              onClick={() => react(item.type, item.id, 'like')}
            >
              <ThumbsUp /> {item.reaction?.likes || 0}
            </button>
            <button
              type="button"
              className={cn(item.reaction?.my_reaction === 'dislike' && 'is-dislike', reactBurst.includes(`${item.type}-${item.id}-dislike`) && 'is-burst')}
              onClick={() => react(item.type, item.id, 'dislike')}
            >
              <ThumbsDown /> {item.reaction?.dislikes || 0}
            </button>
            <button type="button" onClick={share}><Share2 /> 转发到社区</button>
          </div>

          <div className="detail-share-box">
            <Textarea value={shareText} onChange={(event) => setShareText(event.target.value)} placeholder="写一句转发理由，可留空直接转发..." />
          </div>
        </CardContent>
      </Card>

      <Card className="detail-card">
        <CardHeader><CardTitle><MessageSquare /> 留言讨论</CardTitle></CardHeader>
        <CardContent>
          <div className="detail-new-comment">
            <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="写下你的留言，支持楼中楼回复..." />
            <Button onClick={() => submitComment(comment)} disabled={!comment.trim()}><Heart /> 发布留言</Button>
          </div>
          <div className="detail-comment-list">
            {detail.comments?.length ? detail.comments.map((node) => (
              <CommentNode key={node.id} comment={node} target={item} onReply={submitComment} onReact={react} onOpenSource={onOpenTarget} />
            )) : <div className="profile-empty-line">还没有留言，来坐第一排。</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
