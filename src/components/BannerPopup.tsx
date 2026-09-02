import { X } from 'lucide-react'
import { useEffect } from 'react'
import type { Banner } from '../services/bannerService'

interface BannerPopupProps {
  banner: Banner
  onClose: () => void
}

export function BannerPopup({ banner, onClose }: BannerPopupProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Cerrar aviso"
        className="absolute inset-0 bg-neutral-950/75 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl overflow-hidden rounded-xl bg-white dark:bg-zinc-900 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary text-white shadow-lg transition-colors hover:bg-brand-primary-hover"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="overflow-hidden bg-neutral-100 dark:bg-zinc-800">
          <img
            src={banner.imageUrl}
            alt={banner.title}
            className="max-h-[70vh] w-full object-contain"
          />
        </div>

        {banner.title && (
          <div className="border-t border-neutral-200 dark:border-zinc-800 px-5 py-4">
            <p className="text-center text-sm font-semibold text-neutral-900 dark:text-gray-100">
              {banner.title}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
