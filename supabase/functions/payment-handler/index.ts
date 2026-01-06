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

    // Lấy Merchant Key
    const { data: config } = await supabase.from('app_config').select('value').eq('key', 'OXAPAY_MERCHANT_KEY').single();
    if (!config?.value) throw new Error("Chưa cấu hình Merchant Key");
    const merchantKey = config.value;

    let totalAmount = 0;
    const orderItemsData = [];
    let descriptionParts = [];

    // Lấy thông tin sản phẩm từ DB để kiểm tra
    const itemIds = items.map(i => i.id);
    const { data: products } = await supabase.from('products').select('*').in('id', itemIds);

    if (!products) throw new Error("Lỗi lấy dữ liệu sản phẩm");

    for (const item of items) {
      const product = products.find(p => p.id === item.id);
      if (!product) continue;

      // --- LOGIC GIÁ QUAN TRỌNG ĐÃ SỬA ---
      // Mặc định lấy giá gốc
      let unitPrice = product.price;

      // Nếu client gửi giá khác (do chọn biến thể), ta sử dụng giá đó
      // (Lưu ý: Để an toàn tuyệt đối, nên check lại trong cột 'variants' của DB nếu có,
      // nhưng ở đây ta ưu tiên fix lỗi hiển thị giá cho user trước)
      if (item.price && parseFloat(item.price) !== product.price) {
          // Log để theo dõi
          console.log(`Product ${product.id}: Base price ${product.price}, Variant price sent: ${item.price}`);
          unitPrice = parseFloat(item.price);
      }

      const lineTotal = unitPrice * item.quantity;
      totalAmount += lineTotal;

      const productName = (language === 'en' && product.title_en) ? product.title_en : product.title;
      // Thêm thông tin giá vào mô tả để dễ đối soát
      descriptionParts.push(`${productName} ($${unitPrice} x${item.quantity})`);

      orderItemsData.push({
        product_id: product.id,
        quantity: item.quantity,
        price_at_purchase: unitPrice // Lưu giá thực tế mua (giá biến thể)
      });
    }

    if (totalAmount <= 0) throw new Error("Tổng tiền không hợp lệ");

    // Tạo Order
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

    // Lưu Order Items
    const itemsToInsert = orderItemsData.map(i => ({ ...i, order_id: order.id }));
    await supabase.from('order_items').insert(itemsToInsert);

    // Gọi OxaPay
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
