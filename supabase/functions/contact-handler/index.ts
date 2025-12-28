import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { name, email, phone, message } = await req.json();

    // 1. Lưu vào Database
    const { error: dbError } = await supabase.from('contacts').insert({
        name, email, phone, message
    });
    
    if (dbError) throw new Error("Lỗi DB: " + dbError.message);

    // 2. Lấy cấu hình Telegram
    const { data: configs } = await supabase.from('app_config').select('*');
    const botToken = configs?.find(c => c.key === 'TELEGRAM_BOT_TOKEN')?.value;
    const chatId = configs?.find(c => c.key === 'TELEGRAM_CHAT_ID')?.value;

    if (!botToken || !chatId) {
        // Không coi là lỗi fatal, chỉ báo warning nhưng vẫn return success cho khách
        console.log("Thiếu cấu hình Tele");
    } else {
        const msg = `📩 *HỖ TRỢ MỚI*\n👤 ${name}\n📞 ${phone}\n📧 ${email}\n📝 ${message}`;
        const teleRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' })
        });
        
        const teleData = await teleRes.json();
        if (!teleData.ok) {
            // NẾU TELEGRAM LỖI, QUĂNG LỖI RA ĐỂ BIẾT
            throw new Error(`Lỗi Telegram: ${teleData.description}`);
        }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    // Trả về nội dung lỗi chi tiết
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});