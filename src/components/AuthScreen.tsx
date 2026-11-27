import { useState, type FormEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AtlasLogo } from './AtlasLogo';

export function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'error' | 'ok'; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setBusy(true);
    try {
      const { error } = isRegister
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setNotice({ type: 'error', text: error.message });
      } else if (isRegister) {
        setNotice({
          type: 'ok',
          text: 'Cuenta creada. Si se requiere confirmación, revisa tu correo; si no, ya puedes iniciar sesión.',
        });
        setIsRegister(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full h-12 px-4 rounded-xl bg-[#1e1f20] border border-white/10 text-[15px] text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-[#8ab4f8]/60 transition';

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-[radial-gradient(closest-side,rgba(155,114,242,0.18),transparent)]" />

      <div className="relative w-full max-w-sm animate-rise">
        <div className="flex flex-col items-center text-center mb-8">
          <AtlasLogo className="w-12 h-12" />
          <h1 className="mt-5 text-3xl font-medium tracking-tight">
            {isRegister ? 'Crea tu cuenta' : 'Bienvenido a '}
            {!isRegister && <span className="text-gradient">Atlas</span>}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">Tu agente autónomo de ingeniería y AppSec</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {notice && (
            <div
              className={`text-sm px-4 py-3 rounded-xl border ${
                notice.type === 'error'
                  ? 'bg-red-500/[0.08] border-red-500/20 text-red-200'
                  : 'bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-200'
              }`}
            >
              {notice.text}
            </div>
          )}

          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />

          <button
            type="submit"
            disabled={busy}
            className="w-full h-12 rounded-full bg-zinc-100 hover:bg-white text-zinc-900 font-medium text-[15px] disabled:opacity-50 flex items-center justify-center gap-2 transition active:scale-[0.99]"
          >
            {busy && <LoaderCircle className="w-4 h-4 animate-spin" />}
            {isRegister ? 'Crear cuenta' : 'Continuar'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setIsRegister(!isRegister);
            setNotice(null);
          }}
          className="w-full mt-5 text-sm text-zinc-400 hover:text-zinc-200 transition"
        >
          {isRegister ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
        </button>
      </div>
    </div>
  );
}
