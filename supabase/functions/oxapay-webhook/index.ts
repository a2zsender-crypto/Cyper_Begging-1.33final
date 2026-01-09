import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hàm gửi Telegram (Sử dụng Token & ChatID truyền vào từ DB)
async function sendTelegram(token: string, chatId: string, message: string) {
    if (!token || !chatId) return;
    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML' 
            })
        });
    } catch (e) {
        console.error("Telegram Error:", e.message);
    }
}

// Hàm gửi Email
async function sendEmail(apiKey: string, to: string, subject: string, html: string) {
    if (!apiKey) return;
    try {
        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                from: 'Cyper Store <onboarding@resend.dev>',
                to: to,
                subject: subject,
                html: html
            })
        });
    } catch (e) {
        console.error("Email Error:", e.message);
    }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) throw new Error("CRITICAL: Thiếu SUPABASE_SERVICE_ROLE_KEY");

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    );

    // 1. LẤY CẤU HÌNH TỪ DATABASE (Thay vì biến môi trường)
    // - Lấy Bot Token & Chat ID từ app_config
    // - Lấy Nick hỗ trợ từ site_settings
    const [appConfigRes, siteSettingsRes] = await Promise.all([
        supabase.from('app_config').select('key, value').in('key', ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']),
        supabase.from('site_settings').select('contact_telegram').limit(1).single()
    ]);

    const botToken = appConfigRes.data?.find(c => c.key === 'TELEGRAM_BOT_TOKEN')?.value;
    const adminChatId = appConfigRes.data?.find(c => c.key === 'TELEGRAM_CHAT_ID')?.value;
    // Lấy nick tele hỗ trợ, nếu ko có thì fallback về 'admin'
    const supportTele = siteSettingsRes.data?.contact_telegram || 'admin';

    // 2. PARSE WEBHOOK
    const body = await req.json();
    console.log("▶ PAYLOAD:", JSON.stringify(body));

    const orderIdRaw = body.order_id || body.orderId;
    const status = body.status;
    const trackId = body.track_id || body.trackId; // <--- Lấy Tracking ID

    if (!orderIdRaw) throw new Error("Missing order_id");

    const validStatuses = ['Paid', 'paid', 'Completed', 'complete'];
    if (!validStatuses.includes(status)) {
        return new Response(JSON.stringify({ message: "Ignored" }), { status: 200, headers: corsHeaders });
    }

    // 3. LẤY ĐƠN HÀNG
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderIdRaw)
      .single();

    if (orderError || !order) throw new Error(`Order not found: ${orderError?.message}`);
    if (order.status === 'completed') return new Response(JSON.stringify({ message: "Already completed" }), { status: 200, headers: corsHeaders });

    // ==================================================================
    // BƯỚC 1: UPDATE PAID + TRACKING ID (KHÔI PHỤC TRACKING)
    // ==================================================================
    if (order.status === 'pending') {
        const updateData: any = { status: 'paid' };
        if (trackId) updateData.oxapay_track_id = trackId; // Update Track ID vào DB

        const { error: paidError } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', orderIdRaw);
        
        if (paidError) console.error(`Update Paid Error: ${paidError.message}`);
        else {
            console.log(`✅ PAID (TrackID: ${trackId})`);
            // Gửi Tele báo tiền về
            await sendTelegram(botToken, adminChatId, 
                `💰 <b>TIỀN VỀ! Order #${orderIdRaw}</b>\n` +
                `👤 Email: ${order.customer_email}\n` +
                `💵 Tổng: <b>$${order.total_amount || order.amount}</b>`
            );
        }
    }

    // ==================================================================
    // BƯỚC 2: LẤY KEY (Logic cũ)
    // ==================================================================
    const deliveredKeys = []; 
    
    for (const item of order.order_items) {
      if (item.assigned_key && item.assigned_key.length > 5) continue;

      const quantity = item.quantity;
      let itemAssignedKeys = ""; 
      const productName = item.variant_name ? `${item.product_name || 'SP'} (${item.variant_name})` : (item.product_name || `SP ID ${item.product_id}`);

      console.log(`🔎 Tìm ${quantity} key: ${productName}`);

      for (let i = 0; i < quantity; i++) {
        const { data: availableKey, error: findError } = await supabase
          .from('product_keys')
          .select('id, key_value, card_code, serial') 
          .eq('product_id', item.product_id)
          .eq('is_used', false)
          .limit(1)
          .maybeSingle();

        if (findError || !availableKey) { 
            console.error(`❌ HẾT HÀNG: ${productName}`);
            await sendTelegram(botToken, adminChatId, `⚠️ <b>CẢNH BÁO HẾT HÀNG!</b>\nSP: ${productName}\nĐơn: #${orderIdRaw}`);
            continue; 
        }

        await supabase.from('product_keys').update({ is_used: true }).eq('id', availableKey.id);

        const keyInfo = {
            name: productName,
            key: availableKey.key_value || '---',
            code: availableKey.card_code || '', 
            serial: availableKey.serial || ''   
        };
        deliveredKeys.push(keyInfo);

        const infoStr = `Key: ${keyInfo.key}` + 
                        (keyInfo.code ? ` | Code: ${keyInfo.code}` : '') + 
                        (keyInfo.serial ? ` | Serial: ${keyInfo.serial}` : '');
        itemAssignedKeys += infoStr + "\n";
      }

      if (itemAssignedKeys) {
          await supabase.from('order_items').update({ assigned_key: itemAssignedKeys.trim() }).eq('id', item.id);
      }
    }

    // ==================================================================
    // BƯỚC 3: HOÀN TẤT & GỬI EMAIL (DÙNG NICK TELE DB)
    // ==================================================================
    if (deliveredKeys.length > 0) {
        console.log(`🔄 Update Completed...`);

        // Update Completed + TrackID (cho chắc chắn)
        const finalUpdate: any = { 
            status: 'completed', 
            notes: `Delivered ${deliveredKeys.length} keys.` 
        };
        if (trackId) finalUpdate.oxapay_track_id = trackId;

        await supabase.from('orders').update(finalUpdate).eq('id', orderIdRaw);

        // Báo Tele Admin Done
        let teleReport = `✅ <b>ĐƠN HÀNG XONG #${orderIdRaw}</b>\n`;
        teleReport += `📧 ${order.customer_email}\n`;
        deliveredKeys.forEach(k => teleReport += `- ${k.name}\n`);
        await sendTelegram(botToken, adminChatId, teleReport);

        // Chuẩn bị Email
        const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
        const lang = order.language === 'en' ? 'en' : 'vi';
        
        // Tạo link Tele từ DB (bỏ @ nếu có)
        const teleLink = `https://t.me/${supportTele.replace('@','')}`;

        const content = {
            en: {
                subject: `Order #${orderIdRaw} Completed`,
                title: `Thank you for your purchase!`,
                desc: `Here are your product keys:`,
                col_key: "Key/Code",
                col_card: "Card Code",
                col_serial: "Serial",
                footer: `Need help? Contact us via Telegram: <a href="${teleLink}">${supportTele}</a>`
            },
            vi: {
                subject: `Đơn hàng #${orderIdRaw} hoàn thành`,
                title: `Cảm ơn bạn đã mua hàng!`,
                desc: `Dưới đây là mã sản phẩm của bạn:`,
                col_key: "Mã thẻ/Key",
                col_card: "Mã nạp",
                col_serial: "Số Serial",
                footer: `Cần hỗ trợ? Liên hệ Telegram: <a href="${teleLink}">${supportTele}</a>`
            }
        };
        const t = content[lang];

        const keysHtml = deliveredKeys.map(k => `
            <div style="border: 1px solid #ddd; padding: 12px; margin-bottom: 12px; border-radius: 6px; background-color: #f9f9f9;">
                <div style="font-weight:bold; color:#333; margin-bottom:5px;">${k.name}</div>
                <div style="font-size:16px; color:#0070f3; margin-bottom:4px;"><strong>${t.col_key}:</strong> ${k.key}</div>
                ${k.code ? `<div><strong>${t.col_card}:</strong> ${k.code}</div>` : ''}
                ${k.serial ? `<div><strong>${t.col_serial}:</strong> ${k.serial}</div>` : ''}
            </div>
        `).join('');

        const finalHtml = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <h2 style="color: #0088cc;">${t.title}</h2>
                <p>${t.desc}</p>
                ${keysHtml}
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 14px; background: #eef; padding: 10px; border-radius: 5px;">
                    💬 <strong>${t.footer}</strong>
                </p>
            </div>
        `;

        await sendEmail(RESEND_KEY, order.customer_email, t.subject, finalHtml);
    }

    return new Response(JSON.stringify({ message: "Done", delivered: deliveredKeys.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error(`🔥 ERROR: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
