import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

/*
 * In-app replacements for window.confirm / window.prompt, plus small toasts.
 *
 *   const dialogs = useDialogs();
 *   if (!(await dialogs.confirm({ title: 'Delete this gem?', danger: true }))) return;
 *   const reason = await dialogs.prompt({ title: 'Reason for deactivation' }); // string | null
 *   dialogs.toast('Saved', 'success');
 */

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}
interface PromptOptions extends ConfirmOptions {
  placeholder?: string;
  /** Require a non-empty answer before the confirm button enables (default true) */
  required?: boolean;
  multiline?: boolean;
}
type Tone = 'success' | 'error' | 'info';

interface DialogsApi {
  confirm(opts: ConfirmOptions): Promise<boolean>;
  prompt(opts: PromptOptions): Promise<string | null>;
  toast(message: string, tone?: Tone): void;
}

const DialogsContext = createContext<DialogsApi | null>(null);

type Pending =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void };

interface ToastItem { id: number; message: string; tone: Tone }

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ kind: 'confirm', opts, resolve })), []);
  const prompt = useCallback((opts: PromptOptions) => new Promise<string | null>((resolve) => setPending({ kind: 'prompt', opts, resolve })), []);
  const toast = useCallback((message: string, tone: Tone = 'info') => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3500);
  }, []);

  const close = (value: boolean | string | null) => {
    if (!pending) return;
    if (pending.kind === 'confirm') pending.resolve(value === true);
    else pending.resolve(typeof value === 'string' ? value : null);
    setPending(null);
  };

  return (
    <DialogsContext.Provider value={{ confirm, prompt, toast }}>
      {children}
      {pending && <DialogModal pending={pending} onClose={close} />}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white shadow-card-hover animate-slide-up dark:bg-white dark:text-stone-900">
            {t.tone === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success-400 dark:text-success-600" />
              : t.tone === 'error' ? <AlertTriangle className="h-4 w-4 shrink-0 text-error-400 dark:text-error-600" />
              : <Info className="h-4 w-4 shrink-0 text-accent-300 dark:text-accent-600" />}
            <span>{t.message}</span>
            <button onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} className="ml-1 opacity-60 hover:opacity-100" aria-label="Dismiss"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </DialogsContext.Provider>
  );
}

function DialogModal({ pending, onClose }: { pending: Pending; onClose: (v: boolean | string | null) => void }) {
  const { opts } = pending;
  const isPrompt = pending.kind === 'prompt';
  const promptOpts = opts as PromptOptions;
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const required = isPrompt && promptOpts.required !== false;
  const canSubmit = !required || value.trim().length > 0;

  useEffect(() => {
    (isPrompt ? inputRef.current : confirmRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(isPrompt ? null : false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPrompt, onClose]);

  const submit = () => {
    if (!canSubmit) return;
    onClose(isPrompt ? value.trim() : true);
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-stone-950/50 sm:items-center sm:p-4" onClick={() => onClose(isPrompt ? null : false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="w-full rounded-t-4xl bg-white p-6 pb-8 shadow-card-hover animate-slide-up dark:bg-stone-900 sm:max-w-md sm:rounded-4xl sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {opts.danger && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-error-50 text-error-600 dark:bg-error-950/40 dark:text-error-400">
              <AlertTriangle className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 id="dialog-title" className="font-display text-xl font-bold">{opts.title}</h2>
            {opts.message && <p className="mt-1.5 text-sm text-stone-500 dark:text-stone-400">{opts.message}</p>}
          </div>
        </div>

        {isPrompt && (
          <form className="mt-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            {promptOpts.multiline ? (
              <textarea ref={inputRef} className="input min-h-[96px] resize-y" placeholder={promptOpts.placeholder} value={value} onChange={(e) => setValue(e.target.value)} maxLength={500} />
            ) : (
              <input ref={inputRef} className="input" placeholder={promptOpts.placeholder} value={value} onChange={(e) => setValue(e.target.value)} maxLength={500} />
            )}
          </form>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button onClick={() => onClose(isPrompt ? null : false)} className="btn-secondary">{opts.cancelLabel ?? 'Cancel'}</button>
          <button ref={confirmRef} onClick={submit} disabled={!canSubmit} className={opts.danger ? 'btn-danger' : 'btn-primary'}>
            {opts.confirmLabel ?? (isPrompt ? 'Submit' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useDialogs(): DialogsApi {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error('useDialogs must be used within DialogsProvider');
  return ctx;
}
