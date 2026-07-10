import { useEffect, useMemo, useState } from 'react'
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
import ImageLightbox from '@/components/ImageLightbox'
import { TOPIC_KEYS, t as translate } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  createCommunityPost,
  createListing,
  createServiceTask,
  createWantedPost,
} from '@/api/marketplace'

const TYPE_DEFS = [
  { id: 'listing', icon: PackagePlus },
  { id: 'service', icon: Send },
  { id: 'wanted', icon: Search },
  { id: 'community', icon: PenLine },
  { id: 'game', icon: Gamepad2 },
]

const INITIAL_FORM = {
  title: '',
  description: '',
  price: '',
  location: '',
  pickup: '',
  taskType: 'express',
  desiredTime: '',
  topic: '校园生活',
  images: [],
}

const SERVICE_TASK_TYPES = [
  { id: 'express', label: '帮拿快递' },
  { id: 'takeout', label: '帮拿外卖' },
  { id: 'errand', label: '跑腿代办' },
  { id: 'purchase', label: '代购（如山姆）' },
]

const MAX_CAMPUS_AMOUNT = 999999.99

/** Keep uploads viewable: larger edge + higher quality (still base64-safe). */
function compressImage(file, maxSize = 1600, quality = 0.86) {
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

export default function PublishDialog({ open, onOpenChange, initialType = 'listing', onPublished, language = 'zh-CN' }) {
  const [type, setType] = useState(initialType)
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)

  const t = (key, fallback = '') => translate(language, key, fallback)

  const types = useMemo(
    () => TYPE_DEFS.map((item) => ({ ...item, label: t(`publish.type.${item.id}`) })),
    [language],
  )

  const topics = useMemo(
    () => TOPIC_KEYS.map((item) => ({ value: item.zh, label: t(item.key, item.zh) })),
    [language],
  )

  const hints = useMemo(() => {
    const kind = type === 'game' ? 'game' : type
    return {
      title: t(`publish.ph.${kind}.title`),
      description: t(`publish.ph.${kind}.desc`),
      price: t(`publish.ph.${kind}.price`),
      location: t(`publish.ph.${kind}.location`),
    }
  }, [language, type])

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
      setError(t('publish.error.incomplete', '请把标题和内容补充完整'))
      return
    }
    if (type !== 'community' && Number(form.price || 1) > MAX_CAMPUS_AMOUNT) {
      setError(t('publish.error.amount', '金额不能超过 999999.99 元'))
      return
    }
    setSubmitting(true)
    setError('')
    try {
      let response
      if (type === 'service') {
        if (!form.pickup?.trim() || !form.location?.trim()) {
          setError('请填写取货/物品地址和送达门牌地址')
          setSubmitting(false)
          return
        }
        let pickupGeo = null
        let deliveryGeo = null
        try {
          const { geocodeAddress } = await import('@/lib/amap')
          ;[pickupGeo, deliveryGeo] = await Promise.all([
            geocodeAddress(form.pickup.trim()),
            geocodeAddress(form.location.trim()),
          ])
        } catch (geoError) {
          // Keep publishing even if geocode fails; map will use school fallback.
          console.warn('geocode failed', geoError)
        }
        response = await createServiceTask({
          task_type: form.taskType || 'errand',
          title: form.title,
          description: form.description,
          reward: Number(form.price || 1),
          pickup_location: form.pickup.trim(),
          delivery_location: form.location.trim(),
          pickup_latitude: pickupGeo?.lat ?? null,
          pickup_longitude: pickupGeo?.lng ?? null,
          delivery_latitude: deliveryGeo?.lat ?? null,
          delivery_longitude: deliveryGeo?.lng ?? null,
          latitude: pickupGeo?.lat ?? deliveryGeo?.lat ?? null,
          longitude: pickupGeo?.lng ?? deliveryGeo?.lng ?? null,
          desired_delivery_at: form.desiredTime ? new Date(form.desiredTime).toISOString() : null,
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
          topic: form.topic || '校园生活',
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
      onPublished?.(response || { message: t('publish.success', '发布成功，已经出现在校园信息流中') })
    } catch (publishError) {
      setError(publishError.response?.data?.detail || t('publish.fail', '发布失败，请确认后端服务已启动'))
    } finally {
      setSubmitting(false)
    }
  }

  const priceLabel = type === 'service'
    ? t('publish.reward')
    : type === 'wanted'
      ? t('publish.budget')
      : t('publish.price')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="publish-dialog sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles />
            {t('publish.title')}
          </DialogTitle>
          <DialogDescription>{t('publish.desc')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <div className="publish-dialog-body">
            <div className="publish-type-grid">
              {types.map((item) => {
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
                  {type === 'community' ? t('publish.titleOptional', '标题（可选）') : t('publish.titleLabel')}
                </FieldLabel>
                <Input
                  id="publish-title"
                  value={form.title}
                  onChange={update('title')}
                  placeholder={hints.title}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="publish-description">{t('publish.descLabel')}</FieldLabel>
                <Textarea
                  id="publish-description"
                  value={form.description}
                  onChange={update('description')}
                  placeholder={hints.description}
                  rows={4}
                />
              </Field>
              {type === 'community' ? (
                <Field>
                  <FieldLabel htmlFor="publish-topic">{t('publish.topic')}</FieldLabel>
                  <select id="publish-topic" className="publish-topic-select" value={form.topic} onChange={update('topic')}>
                    {topics.map((topic) => (
                      <option key={topic.value} value={topic.value}>#{topic.label}</option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <Field>
                <FieldLabel>{t('publish.images')}</FieldLabel>
                <label className="publish-image-picker">
                  <ImagePlus />
                  <span>{t('publish.uploadHint')}</span>
                  <input hidden type="file" accept="image/*" multiple onChange={addImages} />
                </label>
                {form.images.length ? (
                  <div className="publish-image-grid">
                    {form.images.map((image, index) => (
                      <div key={`${image.slice(0, 24)}-${index}`}>
                        <button
                          type="button"
                          className="publish-image-preview-btn"
                          onClick={() => { setPreviewIndex(index); setPreviewOpen(true) }}
                          aria-label={`${t('publish.preview', '预览')} ${index + 1}`}
                        >
                          <img src={image} alt="" />
                        </button>
                        <button type="button" className="publish-image-remove" onClick={() => removeImage(index)} aria-label={t('publish.removeImage', '移除图片')}><X /></button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <ImageLightbox
                  open={previewOpen}
                  images={form.images}
                  index={previewIndex}
                  onClose={() => setPreviewOpen(false)}
                  onIndexChange={setPreviewIndex}
                />
              </Field>
              {type === 'service' ? (
                <>
                  <Field>
                    <FieldLabel>跑腿类型</FieldLabel>
                    <div className="publish-service-type-row">
                      {SERVICE_TASK_TYPES.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={cn(form.taskType === item.id && 'is-active')}
                          onClick={() => setForm((current) => ({ ...current, taskType: item.id }))}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="publish-pickup">取货 / 物品地址</FieldLabel>
                    <Input
                      id="publish-pickup"
                      value={form.pickup}
                      onChange={update('pickup')}
                      placeholder="快递站/外卖店；代购可填「山姆」"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="publish-location">送达地址（精确到门牌）</FieldLabel>
                    <Input
                      id="publish-location"
                      value={form.location}
                      onChange={update('location')}
                      placeholder="例如：南通理工学院西区 7 栋 502"
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="publish-price">{priceLabel}</FieldLabel>
                      <Input
                        id="publish-price"
                        type="number"
                        min="1"
                        max={MAX_CAMPUS_AMOUNT}
                        value={form.price}
                        onChange={update('price')}
                        placeholder={hints.price}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="publish-desired">期望送达时间</FieldLabel>
                      <Input
                        id="publish-desired"
                        type="datetime-local"
                        value={form.desiredTime}
                        onChange={update('desiredTime')}
                      />
                    </Field>
                  </div>
                </>
              ) : null}
              {type !== 'community' && type !== 'service' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="publish-price">{priceLabel}</FieldLabel>
                    <Input
                      id="publish-price"
                      type="number"
                      min="1"
                      max={MAX_CAMPUS_AMOUNT}
                      value={form.price}
                      onChange={update('price')}
                      placeholder={hints.price}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="publish-location">{t('publish.location')}</FieldLabel>
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
            {error ? <p className="publish-error" role="alert">{error}</p> : null}
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('publish.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t('publish.submitting', '发布中...') : t('publish.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
