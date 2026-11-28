import { MessageSquare, ShieldCheck, Sparkles, Mail, type LucideIcon } from 'lucide-react';
import type { AgentMode } from '../types';

export interface ModeOption {
  id: Exclude<AgentMode, 'gmail'>;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const MODE_OPTIONS: ModeOption[] = [
  {
    id: 'vibecoding',
    label: 'Vibecoding',
    description: 'Programa en cualquier lenguaje, sube los cambios a una rama agent/ y abre un PR',
    icon: Sparkles,
  },
  {
    id: 'appsec',
    label: 'Auditoría AppSec',
    description: 'Busca vulnerabilidades OWASP y propone parches',
    icon: ShieldCheck,
  },
  {
    id: 'general',
    label: 'General',
    description: 'Preguntas de cualquier tema, búsquedas en internet y tareas rápidas',
    icon: MessageSquare,
  },
];

const ALL_MODES: Record<AgentMode, { label: string; icon: LucideIcon }> = {
  vibecoding: { label: 'Vibecoding', icon: Sparkles },
  appsec: { label: 'AppSec', icon: ShieldCheck },
  general: { label: 'General', icon: MessageSquare },
  gmail: { label: 'Asistente', icon: Mail },
};

export function modeMeta(mode: AgentMode): { label: string; icon: LucideIcon } {
  return ALL_MODES[mode] ?? ALL_MODES.general;
}
