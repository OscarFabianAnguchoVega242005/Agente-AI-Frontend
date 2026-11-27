import { FolderTree, ShieldCheck, Sparkles, KeyRound, type LucideIcon } from 'lucide-react';
import type { AgentMode } from '../types';

export interface Suggestion {
  title: string;
  prompt: string;
  mode: Exclude<AgentMode, 'gmail'>;
  icon: LucideIcon;
}

const SUGGESTIONS: Suggestion[] = [
  {
    title: 'Audita la seguridad de mi repositorio',
    prompt:
      'Audita el repositorio seleccionado buscando vulnerabilidades OWASP Top 10 (IDOR, inyección, XSS, secretos expuestos). Entrega un reporte por severidad con el código parcheado.',
    mode: 'appsec',
    icon: ShieldCheck,
  },
  {
    title: 'Explícame la arquitectura del proyecto',
    prompt:
      'Explora el repositorio seleccionado y explícame su arquitectura: stack, carpetas principales, flujo de datos y puntos débiles. Guarda un resumen en la memoria del proyecto.',
    mode: 'general',
    icon: FolderTree,
  },
  {
    title: 'Añade validación con Zod a los endpoints',
    prompt:
      'Revisa los endpoints del repositorio seleccionado y añade validación estricta con Zod a todas las entradas. Sube los cambios en una rama agent/zod-validation.',
    mode: 'vibecoding',
    icon: Sparkles,
  },
  {
    title: 'Revisa secretos y políticas RLS',
    prompt:
      'Revisa el repositorio seleccionado en busca de secretos hardcodeados, claves expuestas en el frontend y consultas a Supabase que dependan solo de RLS. Propón correcciones concretas.',
    mode: 'appsec',
    icon: KeyRound,
  },
];

export function Greeting({ name }: { name: string }) {
  return (
    <div className="animate-rise">
      <h1 className="text-[2.1rem] sm:text-5xl font-medium tracking-tight leading-tight">
        <span className="text-gradient">Hola{name ? `, ${name}` : ''}</span>
      </h1>
      <p className="text-[1.6rem] sm:text-4xl font-medium tracking-tight text-zinc-500 mt-1">
        ¿En qué trabajamos hoy?
      </p>
    </div>
  );
}

export function Suggestions({ onPick }: { onPick: (s: Suggestion) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-rise [animation-delay:80ms]">
      {SUGGESTIONS.map((s) => {
        const Icon = s.icon;
        return (
          <button
            key={s.title}
            type="button"
            onClick={() => onPick(s)}
            className="group text-left rounded-2xl bg-[#1e1f20] hover:bg-[#28292a] border border-white/[0.04] px-4 py-3.5 flex items-center gap-3 transition"
          >
            <span className="w-9 h-9 rounded-full bg-white/[0.05] group-hover:bg-white/[0.08] flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-zinc-300" />
            </span>
            <span className="text-sm text-zinc-300 group-hover:text-zinc-100">{s.title}</span>
          </button>
        );
      })}
    </div>
  );
}
