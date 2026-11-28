import { useEffect } from 'react';
import { LoaderCircle } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel, busy = false, onConfirm, onCancel }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade"
        onClick={busy ? undefined : onCancel}
        aria-hidden="true"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative w-full max-w-sm rounded-3xl bg-[#1e1f20] border border-white/10 shadow-2xl p-5 sm:p-6 animate-pop"
      >
        <h2 id="confirm-title" className="text-lg font-medium text-zinc-100">
          {title}
        </h2>
        <p className="text-sm leading-relaxed text-zinc-400 mt-2 [overflow-wrap:anywhere]">{message}</p>
        {/* En móvil los botones ocupan todo el ancho (más fáciles de pulsar); la acción principal queda arriba */}
        <div className="flex flex-col-reverse gap-2 mt-6 min-[400px]:flex-row min-[400px]:justify-end">
          <button
            onClick={onCancel}
            disabled={busy}
            className="h-11 min-[400px]:h-10 px-4 rounded-full text-sm text-zinc-300 bg-white/[0.04] min-[400px]:bg-transparent hover:bg-white/[0.06] disabled:opacity-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            autoFocus
            className="h-11 min-[400px]:h-10 px-4 rounded-full text-sm font-medium bg-red-500/90 hover:bg-red-500 text-white disabled:opacity-60 flex items-center justify-center gap-2 transition"
          >
            {busy && <LoaderCircle className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
