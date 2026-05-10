import { useEffect, useState } from 'react'

export default function Toast({ shareUrl, onClose }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [onClose])

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl max-w-sm w-full"
      style={{
        background: 'var(--color-surface, #1f2937)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-popup)',
        animation: 'slide-up 0.25s ease forwards',
      }}
      role="status"
      aria-live="polite"
    >
      <span className="text-sm flex-shrink-0" style={{ color: 'var(--voies-primary)' }}>✓</span>
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <p className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
          Simulation sauvegardée
        </p>
        <p
          className="text-[10px] font-mono truncate"
          style={{ color: 'var(--color-text-muted)' }}
          title={shareUrl}
        >
          {shareUrl}
        </p>
      </div>
      <button
        onClick={handleCopy}
        className="px-3 py-1.5 rounded-xl text-xs font-semibold flex-shrink-0 transition-colors"
        style={{
          background: copied
            ? 'color-mix(in srgb, var(--voies-primary) 20%, transparent)'
            : 'var(--voies-primary)',
          color: '#fff',
        }}
      >
        {copied ? '✓' : 'Copier'}
      </button>
      <button
        onClick={onClose}
        aria-label="Fermer"
        className="text-gray-500 hover:text-gray-300 transition-colors text-base leading-none flex-shrink-0"
      >
        ✕
      </button>
    </div>
  )
}
