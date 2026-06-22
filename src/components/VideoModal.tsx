import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getSafeExternalUrl } from '../lib/utils'
import { Modal } from './ui/modal'

interface VideoModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  videoUrl: string | null
}

const getYouTubeEmbedUrl = (raw: string): string | null => {
  try {
    const url = new URL(raw)
    const host = url.hostname.replace(/^www\./, '')
    let videoId: string | null = null
    if (host === 'youtu.be') {
      videoId = url.pathname.slice(1)
    } else if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') videoId = url.searchParams.get('v')
      else if (url.pathname.startsWith('/embed/')) videoId = url.pathname.split('/')[2]
      else if (url.pathname.startsWith('/shorts/')) videoId = url.pathname.split('/')[2]
    }
    if (!videoId) return null
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1`
  } catch {
    return null
  }
}

const getVimeoEmbedUrl = (raw: string): string | null => {
  try {
    const url = new URL(raw)
    const host = url.hostname.replace(/^www\./, '')
    if (host !== 'vimeo.com') return null
    const videoId = url.pathname.split('/').filter(Boolean)[0]
    if (!videoId || !/^\d+$/.test(videoId)) return null
    return `https://player.vimeo.com/video/${videoId}?autoplay=1`
  } catch {
    return null
  }
}

export function VideoModal({ isOpen, onClose, title, videoUrl }: VideoModalProps) {
  const { t } = useTranslation()
  // Sanitize here so every caller is protected (rejects javascript:/data: URLs),
  // even when the URL comes from a third-party source (e.g. MuscleWiki API).
  const safeUrl = getSafeExternalUrl(videoUrl)
  const embedUrl = safeUrl ? getYouTubeEmbedUrl(safeUrl) ?? getVimeoEmbedUrl(safeUrl) : null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      {safeUrl && (
        <div className="flex flex-col gap-3">
          {embedUrl ? (
            <iframe
              key={embedUrl}
              src={embedUrl}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="aspect-video w-full rounded-[14px]"
              style={{ border: 'none' }}
            />
          ) : (
            <video
              key={safeUrl}
              src={safeUrl}
              controls
              autoPlay
              playsInline
              className="w-full rounded-[14px]"
            />
          )}
          <a
            href={safeUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-full py-2.5 font-ot-mono text-[11px] uppercase tracking-[0.08em] transition-colors"
            style={{ color: '#6a6a72', background: '#f0f0f3' }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t('common.open_externally')}
          </a>
        </div>
      )}
    </Modal>
  )
}
