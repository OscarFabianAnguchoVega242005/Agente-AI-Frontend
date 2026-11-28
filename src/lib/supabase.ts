import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

if (!supabaseUrl || !supabaseAnonKey || !apiBaseUrl) {
  throw new Error('Faltan variables de entorno VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY o VITE_API_BASE_URL');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const API_BASE_URL = apiBaseUrl.replace(/\/$/, '');
/** Datos públicos del proyecto (la clave publicable va en el navegador por diseño). */
export const SUPABASE_URL = supabaseUrl.replace(/\/$/, '');
export const SUPABASE_ANON_KEY = supabaseAnonKey;