import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://drxkanfojvtdaswnxpmi.supabase.co";
const supabasePublishableKey = "sb_publishable_PQspzucM4rVXcPYkJmoCMw_AX_Lfo6m";

// Cliente usado por telas que ainda dependem do cliente padrão.
export const supabase = createClient(supabaseUrl, supabasePublishableKey);
export const SUPABASE_CONFIGURED = true;

// Cada painel envia o usuário selecionado para que consultas e políticas do banco
// possam aplicar o mesmo escopo também fora da interface.
export function criarSupabaseParaUsuario(usuario: "Daniel" | "Rafael") {
  return createClient(supabaseUrl, supabasePublishableKey, {
    global: { headers: { "x-delivery-user": usuario } },
  });
}
