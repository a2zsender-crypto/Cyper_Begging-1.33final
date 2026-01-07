import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 1. Xử lý Preflight Request (OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 2. Parse dữ liệu từ Client
    let body;
    try { body = await req.json(); } catch { throw new Error("Invalid JSON body"); }

    const { items, email, name, contactMethod, contactInfo, shippingAddress, phoneNumber, language } = body;

    // Validate cơ bản
    if (!items || !Array.isArray(items) || items.length === 0) throw new Error("Giỏ hàng trống");
    if (!email) throw new Error("Thiếu email khách hàng");

    // 3. Lấy Merchant Key
    const { data: config } = await supabase.from('app_config').select('value').eq('key', 'OXAPAY_MERCHANT_KEY').single();
    if (!config?.value) throw new Error("Chưa cấu hình Merchant Key");
    const merchantKey = config.value;

    // 4. Tính toán tổng tiền & xử lý biến thể
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

      // Logic giá biến thể
      if (item.price && parseFloat(item.price) !== product.price) {
          unitPrice = parseFloat(item.price);
      }

      const lineTotal = unitPrice * item.quantity;
      totalAmount += lineTotal;

      const baseName = (language === 'en' && product.title_en) ? product.title_en : product.title;
      const finalDisplayName = item.name || baseName;

      descriptionParts.push(`${finalDisplayName} ($${unitPrice} x${item.quantity})`);

      orderItemsData.push({
        product_id: product.id,
        quantity: item.quantity,
        price_at_purchase: unitPrice,
        name: finalDisplayName,
        product_name: finalDisplayName // Backup cho admin panel
      });
    }

    if (totalAmount <= 0) throw new Error("Tổng tiền không hợp lệ");

    // 5. Tạo đơn hàng (Pending)
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

    // Insert chi tiết đơn hàng
    const itemsToInsert = orderItemsData.map(i => ({ 
        order_id: order.id,
        product_id: i.product_id,
        quantity: i.quantity,
        price_at_purchase: i.price_at_purchase,
        product_name: i.product_name 
    }));
    
    // Xử lý fallback nếu DB chưa có cột product_name
    const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
    if (itemsError) {
        const basicItems = orderItemsData.map(i => ({
             order_id: order.id,
             product_id: i.product_id,
             quantity: i.quantity,
             price_at_purchase: i.price_at_purchase
        }));
        await supabase.from('order_items').insert(basicItems);
    }

    // 6. GỌI API OXAPAY V1 (SANDBOX MODE)
    // Tài liệu mới: Dùng API v1, Header Key, Snake_case params, Sandbox: true
    const oxapayPayload = {
      amount: totalAmount,
      currency: 'USDT',
      life_time: 60, // API v1 dùng snake_case
      fee_paid_by_payer: 0,
      under_paid_cover: 0,
      return_url: `${req.headers.get('origin')}/success?orderId=${order.id}`,
      callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/oxapay-webhook`,
      order_id: order.id.toString(),
      description: descriptionParts.join(', ').substring(0, 100),
      email: email,
      sandbox: true // <--- KÍCH HOẠT CHẾ ĐỘ SANDBOX
    };

    console.log("Sending to OxaPay v1 (Sandbox):", JSON.stringify(oxapayPayload));

    const oxapayRes = await fetch('https://api.oxapay.com/v1/payment/request', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'merchant-api-key': merchantKey // Key truyền qua Header
      },
      body: JSON.stringify(oxapayPayload)
    });

    const oxapayData = await oxapayRes.json();
    console.log("OxaPay Response:", oxapayData);

    // Kiểm tra kết quả theo chuẩn API v1
    if (oxapayData.status !== 200 && oxapayData.message !== 'success') {
      throw new Error(oxapayData.message || "Lỗi khởi tạo thanh toán OxaPay");
    }
    
    // Lấy link thanh toán từ data
    const { track_id, payment_url } = oxapayData.data;

    // Cập nhật TrackID
    await supabase.from('orders').update({ oxapay_track_id: track_id }).eq('id', order.id);

    // Trả về link cho Client
    return new Response(JSON.stringify({ payUrl: payment_url }), {
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
