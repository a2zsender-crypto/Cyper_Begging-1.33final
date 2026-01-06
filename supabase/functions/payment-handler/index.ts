import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let body;
    try { body = await req.json(); } catch { throw new Error("Invalid JSON body"); }

    const { items, email, name, contactMethod, contactInfo, shippingAddress, phoneNumber, language } = body;

    if (!items || !Array.isArray(items) || items.length === 0) throw new Error("Giỏ hàng trống");
    if (!email) throw new Error("Thiếu email khách hàng");

    const { data: config } = await supabase.from('app_config').select('value').eq('key', 'OXAPAY_MERCHANT_KEY').single();
    if (!config?.value) throw new Error("Chưa cấu hình Merchant Key");
    const merchantKey = config.value;

    let totalAmount = 0;
    const orderItemsData = [];
    let descriptionParts = [];

    const itemIds = items.map(i => i.id);
    const { data: products } = await supabase.from('products').select('*').in('id', itemIds);

    if (!products) throw new Error("Lỗi lấy dữ liệu sản phẩm");

    for (const item of items) {
      const product = products.find(p => p.id === item.id);
      if (!product) continue;

      let unitPrice = product.price;
      if (item.price && parseFloat(item.price) !== product.price) {
          unitPrice = parseFloat(item.price);
      }

      const lineTotal = unitPrice * item.quantity;
      totalAmount += lineTotal;

      // 1. LẤY TÊN ĐẦY ĐỦ CHO OXAPAY VÀ DATABASE
      // Ưu tiên dùng tên client gửi lên (vì đã được ghép biến thể ở Cart.jsx)
      // Nếu không có thì mới fallback về tên gốc trong DB
      const fullDisplayName = item.name || ((language === 'en' && product.title_en) ? product.title_en : product.title);

      descriptionParts.push(`${fullDisplayName} ($${unitPrice} x${item.quantity})`);

      orderItemsData.push({
        product_id: product.id,
        quantity: item.quantity,
        price_at_purchase: unitPrice,
        // 2. LƯU TÊN BIẾN THỂ VÀO DB ĐỂ ADMIN PANEL HIỂN THỊ
        // Cần đảm bảo bảng order_items có cột 'variant_name'
        variant_name: fullDisplayName 
      });
    }

    if (totalAmount <= 0) throw new Error("Tổng tiền không hợp lệ");

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
    
    // Insert order items
    // Lưu ý: Nếu DB chưa có cột variant_name, Supabase có thể báo lỗi hoặc bỏ qua trường này tuỳ cấu hình.
    const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
    if (itemsError) {
        console.error("Insert Items Error (Có thể do thiếu cột variant_name):", itemsError);
        // Fallback: Nếu lỗi insert (do dư cột variant_name), thử insert lại bản thiếu cột này để đơn hàng vẫn chạy
        if (itemsError.message?.includes('column "variant_name" of relation "order_items" does not exist')) {
             const fallbackItems = itemsToInsert.map(({ variant_name, ...rest }) => rest);
             await supabase.from('order_items').insert(fallbackItems);
        }
    }

    const oxapayPayload = {
      merchant: merchantKey,
      amount: totalAmount,
      currency: 'USDT',
      lifeTime: 60,
      returnUrl: `${req.headers.get('origin')}/success?orderId=${order.id}`,
      callbackUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/oxapay-webhook`,
      orderId: order.id.toString(),
      description: descriptionParts.join(', ').substring(0, 100),
      email: email
    };

    const oxapayRes = await fetch('https://api.oxapay.com/merchants/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(oxapayPayload)
    });

    const oxapayData = await oxapayRes.json();
    if (oxapayData.result !== 100) throw new Error(oxapayData.message || "Lỗi Oxapay");

    await supabase.from('orders').update({ oxapay_track_id: oxapayData.trackId }).eq('id', order.id);

    return new Response(JSON.stringify({ payUrl: oxapayData.payLink }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error("Payment Handler Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});
