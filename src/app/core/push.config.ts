/**
 * Clave PÚBLICA VAPID para las notificaciones push (no es secreta: viaja al navegador).
 * Genera el par con:  npx web-push generate-vapid-keys
 * La privada va solo en los secretos de la función de Supabase.
 */
export const VAPID_PUBLIC_KEY = 'BCaRSf1pbNrluGvtTbYk9G5U74rL_2RMDffIK5NznaXz568HdDAnvR3ZTO7SLd0mmqos_EcoseWtBRuo8nXnHRE';
