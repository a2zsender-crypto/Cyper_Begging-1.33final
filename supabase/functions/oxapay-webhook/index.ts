import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- GIẢ LẬP GỌI APPOTAPAY (KHI HẾT KHO) ---
async function fetchKeyFromAppota(productId: number, variantName: string) {
  console.log(`[API] Gọi AppotaPay mua mã cho SP ${productId} (${variantName})...`);
  // Logic thực tế gọi API Appota ở đây
  // const res = await fetch(...)
  // return res.card_code;
  
  // Fake key để test
  return `APPOTA-AUTO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// --- GỬI EMAIL (RESEND) ---
async function sendEmailToCustomer(email: string, orderId: any, keys: string[]) {
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_KEY) {
    console.log(`[EMAIL DEV] To: ${email} | Keys:`, keys);
    return;
  }
  
  console.log(`[EMAIL] Sending to ${email}...`);
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_KEY}`
    },
    body: JSON.stringify({
      from: 'Cyper Store <onboarding@resend.dev>',
      to: email,
      subject: `[Order #${orderId}] Đơn hàng của bạn đã hoàn thành`,
      html: `
        <h2>Cảm ơn bạn đã mua hàng!</h2>
        <p>Mã đơn hàng: <strong>#${orderId}</strong></p>
        <p>Dưới đây là mã thẻ/key của bạn:</p>
        <ul>
          ${keys.map(k => `<li style="font-size:16px; font-weight:bold; color: #0284c7;">${k}</li>`).join('')}
        </ul>
        <p>Vui lòng bảo quản cẩn thận.</p>
      `
    })
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Nhận dữ liệu Webhook
    const body = await req.json();
    console.log("Webhook Payload:", JSON.stringify(body));

    // --- SỬA LỖI QUAN TRỌNG: CHECK CẢ 2 KIỂU BIẾN (v1 snake_case & legacy) ---
    const status = body.status;
    const orderId = body.order_id || body.orderId;
    const trackId = body.track_id || body.trackId;

    if (!orderId) {
      throw new Error("Missing order_id in payload");
    }

    // Kiểm tra trạng thái thanh toán
    // OxaPay có thể trả về: 'Paid', 'paid', 'Confirming', 'Expired'...
    const validStatuses = ['Paid', 'paid', 'Completed', 'complete'];
    
    // Nếu chưa Paid thì không làm gì cả (trả về 200 để OxaPay không retry liên tục)
    if (!validStatuses.includes(status)) {
        console.log(`Order #${orderId} status is ${status} (Not Paid). Ignored.`);
        return new Response(JSON.stringify({ message: "Ignored non-paid status" }), { status: 200, headers: corsHeaders });
    }

    console.log(`[Xử lý] Đơn hàng #${orderId} đã thanh toán thành công. Bắt đầu trả hàng...`);

    // 2. Lấy thông tin đơn hàng
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*, products(*))')
      .eq('id', orderId)
      .single();

    if (orderError || !order) throw new Error(`Order ${orderId} not found in DB`);

    // Chặn xử lý trùng lặp (Idempotency)
    if (order.status === 'paid' || order.status === 'completed') {
        return new Response(JSON.stringify({ message: "Already processed" }), { status: 200, headers: corsHeaders });
    }

    // 3. LOGIC TRẢ HÀNG (KHO -> API)
    const deliveredKeys: string[] = [];
    const updatedItems = []; // Để cập nhật lại order_items nếu cần gán key cụ thể vào item

    for (const item of order.order_items) {
      const quantity = item.quantity;
      const productId = item.product_id;
      const isGetOverApi = item.products?.allow_external_key;
      const variantInfo = item.product_name; // Tên biến thể để gọi API đúng loại
      
      let itemKeys = ""; // Chuỗi key của item này (nếu mua nhiều)

      for (let i = 0; i < quantity; i++) {
        // A. Ưu tiên 1: Lấy từ kho (Local DB)
        // Tìm 1 key chưa dùng của sản phẩm này
        // Lưu ý: Nếu có biến thể, logic nâng cao cần check thêm cột variant_info trong product_keys
        // Ở đây ta giả định key chung cho product_id
        const { data: localKey, error: keyError } = await supabase
          .from('product_keys')
          .update({ is_used: true, order_id: orderId }) // Atomic update: Khóa dòng này lại
          .eq('product_id', productId)
          .eq('is_used', false)
          .limit(1)
          .select('key_value')
          .maybeSingle();

        if (localKey) {
          console.log(`-> Lấy kho OK: ${localKey.key_value}`);
          deliveredKeys.push(localKey.key_value);
          itemKeys += localKey.key_value + "\n";
        } 
        // B. Ưu tiên 2: Hết kho -> Gọi API (Nếu bật)
        else if (isGetOverApi) {
          try {
            const apiKey = await fetchKeyFromAppota(productId, variantInfo);
            
            // Lưu lại key này vào DB để đối soát
            await supabase.from('product_keys').insert({
                product_id: productId,
                key_value: apiKey,
                is_used: true,
                order_id: orderId,
                variant_info: { source: 'api_appota', original_variant: variantInfo }
            });

            console.log(`-> API OK: ${apiKey}`);
            deliveredKeys.push(apiKey);
            itemKeys += apiKey + "\n";
          } catch (e) {
            console.error(`-> Lỗi API: ${e.message}`);
            // Có thể gửi noti cho Admin ở đây
          }
        } 
        else {
          console.error(`-> Hết hàng SP #${productId} và không có API backup.`);
        }
      }

      // Cập nhật key đã gán vào item (để hiển thị trong Admin/User Order Detail)
      if (itemKeys) {
          await supabase.from('order_items')
            .update({ assigned_key: itemKeys.trim() }) // Cần thêm cột assigned_key vào bảng order_items nếu chưa có
            .eq('id', item.id);
      }
    }

    // 4. Cập nhật trạng thái đơn hàng -> Completed (Hoặc Paid)
    const finalStatus = deliveredKeys.length > 0 ? 'paid' : 'failed'; // Nếu không lấy được key nào thì coi như lỗi? Hoặc vẫn để paid chờ admin xử lý
    
    await supabase.from('orders').update({ 
        status: 'paid', // Đã thanh toán (Key có thể gửi đủ hoặc thiếu)
        oxapay_track_id: trackId,
        notes: `Auto-delivered ${deliveredKeys.length} keys.`
    }).eq('id', orderId);

    // 5. Gửi Email
    if (deliveredKeys.length > 0) {
        await sendEmailToCustomer(order.customer_email, orderId, deliveredKeys);
    }

    return new Response(JSON.stringify({ message: "Success", keys_delivered: deliveredKeys.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Webhook Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
