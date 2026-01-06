import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

// --- CẤU HÌNH ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hàm tính HMAC để verify (Bảo mật)
async function verifyHmac(body: string, hmacHeader: string, merchantKey: string) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(merchantKey);
  const bodyData = encoder.encode(body);

  const key = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-512" }, false, ["verify"]
  );

  // OxaPay gửi HMAC dạng Hex, ta cần verify
  // Lưu ý: Logic verify đơn giản nhất là so sánh chuỗi hash
  // Ở đây giả lập verify, thực tế OxaPay document yêu cầu so sánh hash(body, key) == header
  // Nếu OxaPay không gửi header HMAC chuẩn, ta có thể check 'merchant_key' trong body nếu có
  return true; // Tạm thời return true để flow chạy, CẦN UPDATE theo Document chính xác của OxaPay
}

// --- GIẢ LẬP GỌI APPOTAPAY (API ĐỐI TÁC) ---
async function fetchKeyFromAppota(productId: number, variant: string, amount: number) {
  console.log(`[API] Đang gọi AppotaPay mua mã cho SP ${productId}...`);
  
  // LOGIC THỰC TẾ (Sẽ mở khi bạn có API Appota)
  /*
  const res = await fetch(Deno.env.get('APPOTA_API_URL'), {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${Deno.env.get('APPOTA_API_KEY')}` },
    body: JSON.stringify({ product_code: variant, ... })
  });
  const data = await res.json();
  return data.card_code; 
  */
 
  // Return giả lập để test
  return `APPOTA-AUTO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// --- HÀM GỬI EMAIL (Qua Resend hoặc SMTP) ---
async function sendEmailToCustomer(email: string, orderId: any, keys: string[]) {
  console.log(`[EMAIL] Đang gửi ${keys.length} key tới ${email}`);
  
  // Ví dụ dùng Resend (Free 3000 emails/tháng)
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_KEY) {
    console.log("Chưa cấu hình RESEND_KEY, in key ra log:", keys);
    return;
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_KEY}`
    },
    body: JSON.stringify({
      from: 'Cyper Store <onboarding@resend.dev>', // Cần verify domain để đổi tên
      to: email,
      subject: `Order #${orderId} Completed - Your Keys`,
      html: `
        <h1>Cảm ơn bạn đã mua hàng!</h1>
        <p>Mã đơn hàng: ${orderId}</p>
        <h3>Danh sách mã thẻ của bạn:</h3>
        <ul>
          ${keys.map(k => `<li><b>${k}</b></li>`).join('')}
        </ul>
        <p>Vui lòng lưu trữ cẩn thận.</p>
      `
    })
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Bắt buộc dùng Service Role để update kho
    );

    // 1. Lấy dữ liệu Webhook
    const textBody = await req.text(); // Lấy raw text để verify HMAC
    let body;
    try { body = JSON.parse(textBody); } catch { throw new Error("Invalid JSON"); }

    // 2. BẢO MẬT: Verify HMAC (Hoặc so sánh Merchant Key trong body nếu OxaPay gửi kèm)
    // const hmacHeader = req.headers.get('hmac') || req.headers.get('HMAC');
    // const merchantKey = Deno.env.get('OXAPAY_MERCHANT_KEY');
    // if (!await verifyHmac(textBody, hmacHeader, merchantKey)) {
    //    return new Response(JSON.stringify({error: "Invalid Signature"}), {status: 401});
    // }
    
    // Check status thanh toán
    const { status, orderId, trackId } = body;
    
    // OxaPay thường gửi status: 'Paid', 'Expired', ...
    if (status !== 'Paid' && status !== 'paid' && status !== 'Confirming') {
        return new Response(JSON.stringify({ message: "Order not paid yet" }), { status: 200 });
    }

    console.log(`[Webhook] Xử lý đơn hàng ${orderId}, Status: ${status}`);

    // 3. Lấy thông tin đơn hàng từ DB
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*, products(*))') // Join lấy product check config
      .eq('id', orderId)
      .single();

    if (orderError || !order) throw new Error("Order not found");

    // Nếu đơn đã xử lý rồi thì bỏ qua (Tránh trùng lặp)
    if (order.status === 'completed') {
        return new Response(JSON.stringify({ message: "Already processed" }), { status: 200 });
    }

    // 4. XỬ LÝ KHO & LẤY KEY (Inventory Logic)
    const deliveredKeys = []; // Chứa danh sách key sẽ gửi khách

    for (const item of order.order_items) {
      const quantity = item.quantity;
      const productId = item.product_id;
      const isGetOverApi = item.products?.allow_external_key; // Cờ check xem có lấy qua API ko
      
      console.log(`Processing Product ${productId}, Qty: ${quantity}, OverAPI: ${isGetOverApi}`);

      for (let i = 0; i < quantity; i++) {
        // A. CỐ GẮNG LẤY KEY CÓ SẴN TRONG KHO (Atomic Update)
        // Tìm 1 key chưa dùng của product này và update luôn
        const { data: localKey, error: keyError } = await supabase
          .from('product_keys')
          .update({ is_used: true, order_id: orderId })
          .eq('product_id', productId)
          .eq('is_used', false)
          .limit(1) // Chỉ lấy 1
          .select('key_value') // Trả về key
          .maybeSingle();

        if (localKey) {
          // TH1: Có hàng trong kho
          console.log(`-> Lấy kho thành công: ${localKey.key_value}`);
          deliveredKeys.push(localKey.key_value);
        } else {
          // TH2: Hết hàng trong kho
          if (isGetOverApi) {
            // -> Gọi API AppotaPay
            try {
                const newKeyVal = await fetchKeyFromAppota(productId, item.product_name, item.price_at_purchase);
                
                // Lưu key mới vào kho (đã dùng luôn)
                await supabase.from('product_keys').insert({
                    product_id: productId,
                    key_value: newKeyVal,
                    is_used: true,
                    order_id: orderId
                });
                
                console.log(`-> Gọi API thành công: ${newKeyVal}`);
                deliveredKeys.push(newKeyVal);
            } catch (apiErr) {
                console.error(`-> Lỗi gọi API Appota: ${apiErr.message}`);
                // Có thể gửi noti cho Admin xử lý tay
            }
          } else {
            console.error(`-> Hết hàng và không có cấu hình API cho SP ${productId}`);
            // Note: Đơn hàng sẽ bị thiếu key, cần Admin xử lý
          }
        }
      }
    }

    // 5. Cập nhật trạng thái đơn hàng -> Completed
    await supabase.from('orders').update({ 
        status: 'completed',
        oxapay_track_id: trackId, // Update trackId mới nhất nếu cần
        notes: `Delivered ${deliveredKeys.length} keys.`
    }).eq('id', orderId);

    // 6. Gửi Email cho khách
    if (deliveredKeys.length > 0) {
        await sendEmailToCustomer(order.customer_email, orderId, deliveredKeys);
    }

    return new Response(JSON.stringify({ message: "Success" }), {
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
