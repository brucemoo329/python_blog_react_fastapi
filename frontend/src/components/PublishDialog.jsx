import { useEffect, useState } from 'react'
import { Gamepad2, PackagePlus, PenLine, Search, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  createCommunityPost,
  createListing,
  createServiceTask,
  createWantedPost,
} from '@/api/marketplace'

const TYPES = [
  { id: 'listing', label: '发布闲置', icon: PackagePlus },
  { id: 'service', label: '发布跑腿', icon: Send },
  { id: 'wanted', label: '发求购', icon: Search },
  { id: 'community', label: '发动态', icon: PenLine },
  { id: 'game', label: '游戏交易', icon: Gamepad2 },
]

const INITIAL_FORM = {
  title: '',
  description: '',
  price: '',
  location: '',
}

export default function PublishDialog({ open, onOpenChange, initialType = 'listing', onPublished }) {
  const [type, setType] = useState(initialType)
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) setType(initialType)
  }, [initialType, open])

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!form.description.trim() || (type !== 'community' && !form.title.trim())) {
      setError('请把标题和内容补充完整')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      if (type === 'service') {
        await createServiceTask({
          task_type: 'errand',
          title: form.title,
          description: form.description,
          reward: Number(form.price || 1),
          delivery_location: form.location || '校内',
        })
      } else if (type === 'wanted') {
        await createWantedPost({
          title: form.title,
          description: form.description,
          budget_max: form.price ? Number(form.price) : null,
          location_name: form.location,
        })
      } else if (type === 'community') {
        await createCommunityPost({
          title: form.title || null,
          content: form.description,
          topic: '校园生活',
        })
      } else {
        await createListing({
          title: form.title,
          description: form.description,
          price: Number(form.price || 1),
          trade_type: type === 'game' ? 'digital' : 'physical',
          condition: 'good',
          location_name: form.location,
          image_urls: [],
        })
      }
      setForm(INITIAL_FORM)
      onOpenChange(false)
      onPublished?.('发布成功，已经出现在校园信息流中')
    } catch (publishError) {
      setError(publishError.response?.data?.detail || '发布失败，请确认后端服务已启动')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="publish-dialog sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles />
            发布到校园脉动
          </DialogTitle>
          <DialogDescription>选择内容类型，同校同学会优先看到你的发布。</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <div className="publish-type-grid">
            {TYPES.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(type === item.id && 'is-active')}
                  onClick={() => setType(item.id)}
                >
                  <Icon />
                  {item.label}
                </button>
              )
            })}
          </div>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="publish-title">
                {type === 'community' ? '标题（可选）' : '标题'}
              </FieldLabel>
              <Input
                id="publish-title"
                value={form.title}
                onChange={update('title')}
                placeholder="一句话让同学看懂"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="publish-description">详细描述</FieldLabel>
              <Textarea
                id="publish-description"
                value={form.description}
                onChange={update('description')}
                placeholder="成色、时间、地点或其他需要说明的信息"
                rows={4}
              />
            </Field>
            {type !== 'community' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="publish-price">
                    {type === 'service' ? '跑腿赏金' : type === 'wanted' ? '最高预算' : '价格'}
                  </FieldLabel>
                  <Input
                    id="publish-price"
                    type="number"
                    min="1"
                    value={form.price}
                    onChange={update('price')}
                    placeholder="¥ 0.00"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="publish-location">校内地点</FieldLabel>
                  <Input
                    id="publish-location"
                    value={form.location}
                    onChange={update('location')}
                    placeholder="例如：西区宿舍 7 栋"
                  />
                </Field>
              </div>
            ) : null}
          </FieldGroup>
          {error ? <p className="publish-error" role="alert">{error}</p> : null}
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? '发布中...' : '确认发布'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
