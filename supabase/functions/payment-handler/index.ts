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
    const url = new URL(req.url);

    // --- 1. WEBHOOK (XỬ LÝ KHI THANH TOÁN XONG) ---
    // (Phần này giữ nguyên code của mày, không sửa gì)
    if (url.pathname.endsWith('/webhook')) {
        const formData = await req.formData(); // Lưu ý: Nếu Oxapay gửi JSON thì đoạn này sẽ lỗi, nhưng nếu mày test webhook chạy ok rồi thì giữ nguyên.
        // ... (Code webhook cũ của mày giữ nguyên ở đây) ...
        // Để ngắn gọn tao không paste lại phần Webhook vì lỗi không nằm ở đây.
        // Mày giữ nguyên phần Webhook cũ nhé.
        return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // --- 2. TẠO CHECKOUT (XỬ LÝ LỖI NGÔN NGỮ TẠI ĐÂY) ---
    let body;
    try { body = await req.json(); } catch { throw new Error("Body rỗng"); }
    
    // THÊM: Nhận biến language từ Client
    const { items, email, name, contactMethod, contactInfo, shippingAddress, phoneNumber, language } = body;

    if (!items || items.length === 0 || !email) throw new Error("Giỏ hàng trống");
    
    const { data: config } = await supabase.from('app_config').select('*').eq('key', 'OXAPAY_MERCHANT_KEY').single();
    const merchantKey = config?.value;
    if (!merchantKey || merchantKey.includes('thay_')) throw new Error("Lỗi cấu hình Merchant Key");

    let totalAmount = 0;
    const orderItemsData = [];
    let description = "Order: ";

    for (const item of items) {
        const { data: product } = await supabase.from('products').select('*').eq('id', item.id).single();
        if (!product) continue;
        
        const lineTotal = product.price * item.quantity;
        totalAmount += lineTotal;

        // --- SỬA: LOGIC CHỌN TÊN SẢN PHẨM THEO NGÔN NGỮ ---
        const productName = (language === 'en' && product.title_en) ? product.title_en : product.title;
        description += `${productName} (x${item.quantity}), `;
        // ---------------------------------------------------

        orderItemsData.push({ product_id: product.id, quantity: item.quantity, price_at_purchase: product.price });
    }

    // LƯU ĐỊA CHỈ VÀ SĐT VÀO DB
    const { data: order, error: orderError } = await supabase.from('orders').insert({
        amount: totalAmount, 
        customer_email: email, 
        customer_name: name, 
        contact_method: contactMethod, 
        contact_info: contactInfo, 
        shipping_address: shippingAddress,
        phone_number: phoneNumber,
        status: 'pending'
    }).select().single();

    if (orderError) throw orderError;

    const itemsToInsert = orderItemsData.map(i => ({ ...i, order_id: order.id }));
    await supabase.from('order_items').insert(itemsToInsert);

    const oxapayPayload = {
      merchant: merchantKey, amount: totalAmount, currency: 'USDT', lifeTime: 60, feePaidByPayer: 0,
      returnUrl: `${req.headers.get('origin')}/success?orderId=${order.id}`, 
      // Chỗ này giữ nguyên logic callback cũ của mày
      callbackUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-handler/webhook`,
      orderId: order.id.toString(), description: description.substring(0, 100)
    };

    const oxapayRes = await fetch('https://api.oxapay.com/merchants/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(oxapayPayload) });
    const oxapayData = await oxapayRes.json();
    if (oxapayData.result !== 100) throw new Error(oxapayData.message || "Lỗi Oxapay");
    await supabase.from('orders').update({ oxapay_track_id: oxapayData.trackId }).eq('id', order.id);

    return new Response(JSON.stringify({ payUrl: oxapayData.payLink }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
