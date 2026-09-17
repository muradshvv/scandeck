export function LoadingOverlay({ text }: { text: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[var(--color-border-strong)] border-t-[var(--color-accent)]" />
      <span className="text-sm text-[var(--color-text-secondary)]">{text}</span>
    </div>
  )
}
