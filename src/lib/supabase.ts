import { createClient } from "@supabase/supabase-js";

// Projeto Fotos Aline: usa somente a chave pública (publishable) no navegador.
// A segurança dos dados é aplicada por autenticação e políticas RLS no Supabase.
const supabaseUrl = "https://drxkanfojvtdaswnxpmi.supabase.co";
const supabasePublishableKey = "sb_publishable_PQspzucM4rVXcPYkJmoCMw_AX_Lfo6m";

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
export const SUPABASE_CONFIGURED = true;
