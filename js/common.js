import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const cfg=window.NAMCHON_CONFIG;
export const configured = Boolean(cfg?.SUPABASE_URL?.startsWith('https://') &&cfg?.SUPABASE_ANON_KEY);
export const db=configured?createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
export const categories=['한우','한돈','냉동상품','수입육','완제품'];
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function getSettings(){if(!db)return {};const {data,error}=await db.from('site_settings').select('key,value');if(error)throw error;return Object.fromEntries((data||[]).map(x=>[x.key,x.value]));}
export function msg(error){return error?.message||String(error)}
