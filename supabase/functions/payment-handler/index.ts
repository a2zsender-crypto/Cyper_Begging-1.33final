import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Xử lý CORS cho trình duyệt
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );
    const url = new URL(req.url);

    // --- 1. PHẦN WEBHOOK (GIỮ NGUYÊN HOẶC BỎ QUA NẾU BẠN TÁCH RIÊNG) ---
    // Vì bạn đã tách webhook ra file riêng rồi, nên file này chỉ cần lo phần tạo Link thôi.
    
    // --- 2. PHẦN TẠO LINK THANH TOÁN (Logic chính) ---
    let body;
    try { body = await req.json(); } catch { throw new Error("Body rỗng"); }
    
    // NHẬN BIẾN LANGUAGE TỪ CLIENT
    const { items, email, name, contactMethod, contactInfo, shippingAddress, phoneNumber, language } = body;

    if (!items || items.length === 0 || !email) throw new Error("Giỏ hàng trống");
    
    // Lấy Merchant Key từ Database (bảng app_config)
    const { data: config } = await supabase.from('app_config').select('*').eq('key', 'OXAPAY_MERCHANT_KEY').single();
    const merchantKey = config?.value;
    if (!merchantKey) throw new Error("Chưa cấu hình Merchant Key");

    let totalAmount = 0;
    const orderItemsData = [];
    let description = "Order: ";

    for (const item of items) {
        const { data: product } = await supabase.from('products').select('*').eq('id', item.id).single();
        if (!product) continue;
        
        const lineTotal = product.price * item.quantity;
        totalAmount += lineTotal;

        // --- SỬA TÊN SẢN PHẨM THEO NGÔN NGỮ ---
        // Nếu user chọn tiếng Anh ('en') và có tên tiếng Anh -> Lấy tên tiếng Anh
        // Ngược lại lấy tên mặc định (Tiếng Việt)
        const productName = (language === 'en' && product.title_en) ? product.title_en : product.title;
        
        description += `${productName} (x${item.quantity}), `;
        orderItemsData.push({ product_id: product.id, quantity: item.quantity, price_at_purchase: product.price });
    }

    // TẠO ĐƠN HÀNG STATUS = PENDING
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

    // LƯU CHI TIẾT ĐƠN HÀNG
    const itemsToInsert = orderItemsData.map(i => ({ ...i, order_id: order.id }));
    await supabase.from('order_items').insert(itemsToInsert);

    // GỌI QUA OXAPAY
    const oxapayPayload = {
      merchant: merchantKey, 
      amount: totalAmount, 
      currency: 'USDT', 
      lifeTime: 60, 
      feePaidByPayer: 0,
      returnUrl: `${req.headers.get('origin')}/success?orderId=${order.id}`, 
      // Link webhook để Oxapay báo về khi xong (Trỏ vào function oxapay-webhook)
      callbackUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/oxapay-webhook`,
      orderId: order.id.toString(), 
      description: description.substring(0, 100),
      email: email
    };

    const oxapayRes = await fetch('https://api.oxapay.com/merchants/request', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(oxapayPayload) 
    });
    
    const oxapayData = await oxapayRes.json();
    if (oxapayData.result !== 100) throw new Error(oxapayData.message || "Lỗi Oxapay");
    
    // Cập nhật TrackID
    await supabase.from('orders').update({ oxapay_track_id: oxapayData.trackId }).eq('id', order.id);

    return new Response(JSON.stringify({ payUrl: oxapayData.payLink }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
