import { useEffect, useState } from 'react'
import { Gamepad2, ImagePlus, PackagePlus, PenLine, Search, Send, Sparkles, X } from 'lucide-react'
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
  images: [],
}

const COPY_BY_TYPE = {
  listing: {
    title: '比如：罗技鼠标 9 成新',
    description: '写清楚成色、购买时间、配件、是否可小刀和面交地点。',
    price: '你的出手价，例如 49',
    location: '例如：西区宿舍 7 栋 / 图书馆门口',
  },
  game: {
    title: '比如：王者荣耀皮肤号 / Steam 游戏共享',
    description: '写清楚游戏区服、账号/道具内容、交易方式和安全说明。',
    price: '游戏交易价格',
    location: '线上交易或校内确认地点',
  },
  service: {
    title: '比如：帮拿外卖到 4 栋',
    description: '写清楚取件点、送达点、截止时间、是否需要排队。',
    price: '跑腿赏金，例如 5',
    location: '送达地点，例如：男生宿舍 4 栋',
  },
  wanted: {
    title: '比如：求购计算机网络教材',
    description: '写清楚想要的版本、预算范围、是否接受旧书。',
    price: '最高预算，例如 30',
    location: '希望交易地点',
  },
  community: {
    title: '标题可选，比如：今天操场晚霞好美',
    description: '分享校园见闻、避坑提醒、交易经验或同学互助信息。',
    price: '',
    location: '',
  },
}

function compressImage(file, maxSize = 900, quality = 0.74) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const image = new Image()
      image.onerror = reject
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  })
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

  const addImages = async (event) => {
    const files = Array.from(event.target.files || []).slice(0, 6 - form.images.length)
    if (!files.length) return
    const images = await Promise.all(files.map((file) => compressImage(file)))
    setForm((current) => ({ ...current, images: [...current.images, ...images].slice(0, 6) }))
    event.target.value = ''
  }

  const removeImage = (index) => {
    setForm((current) => ({ ...current, images: current.images.filter((_, itemIndex) => itemIndex !== index) }))
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
      let response
      if (type === 'service') {
        response = await createServiceTask({
          task_type: 'errand',
          title: form.title,
          description: form.description,
          reward: Number(form.price || 1),
          delivery_location: form.location || '校内',
          image_url: form.images[0] || null,
        })
      } else if (type === 'wanted') {
        response = await createWantedPost({
          title: form.title,
          description: form.description,
          budget_max: form.price ? Number(form.price) : null,
          location_name: form.location,
          image_url: form.images[0] || null,
        })
      } else if (type === 'community') {
        response = await createCommunityPost({
          title: form.title || null,
          content: form.description,
          topic: '校园生活',
          image_url: form.images[0] || null,
        })
      } else {
        response = await createListing({
          title: form.title,
          description: form.description,
          price: Number(form.price || 1),
          trade_type: type === 'game' ? 'digital' : 'physical',
          condition: 'good',
          location_name: form.location,
          image_urls: form.images,
        })
      }
      setForm(INITIAL_FORM)
      onOpenChange(false)
      onPublished?.(response || { message: '发布成功，已经出现在校园信息流中' })
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
          {(() => {
            const hints = COPY_BY_TYPE[type] || COPY_BY_TYPE.listing
            return (
              <>
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
                placeholder={hints.title}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="publish-description">详细描述</FieldLabel>
              <Textarea
                id="publish-description"
                value={form.description}
                onChange={update('description')}
                placeholder={hints.description}
                rows={4}
              />
            </Field>
            <Field>
              <FieldLabel>图片</FieldLabel>
              <label className="publish-image-picker">
                <ImagePlus />
                <span>上传商品或内容图片，最多 6 张</span>
                <input hidden type="file" accept="image/*" multiple onChange={addImages} />
              </label>
              {form.images.length ? (
                <div className="publish-image-grid">
                  {form.images.map((image, index) => (
                    <div key={`${image.slice(0, 24)}-${index}`}>
                      <img src={image} alt="" />
                      <button type="button" onClick={() => removeImage(index)}><X /></button>
                    </div>
                  ))}
                </div>
              ) : null}
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
                    placeholder={hints.price}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="publish-location">校内地点</FieldLabel>
                  <Input
                    id="publish-location"
                    value={form.location}
                    onChange={update('location')}
                    placeholder={hints.location}
                  />
                </Field>
              </div>
            ) : null}
          </FieldGroup>
              </>
            )
          })()}
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
