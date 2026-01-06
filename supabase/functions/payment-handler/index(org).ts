import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 1. Xử lý Preflight Request (OPTIONS) - Chống lỗi CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Sử dụng SERVICE_ROLE_KEY để có quyền ghi đơn hàng và đọc cấu hình
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 2. Parse dữ liệu từ Client
    let body;
    try {
      body = await req.json();
    } catch {
      throw new Error("Invalid JSON body");
    }

    const { items, email, name, contactMethod, contactInfo, shippingAddress, phoneNumber, language } = body;

    // Validate dữ liệu đầu vào
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error("Giỏ hàng trống");
    }
    if (!email) {
      throw new Error("Thiếu email khách hàng");
    }

    // 3. Lấy Merchant Key từ Database (bảng app_config)
    const { data: config, error: configError } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'OXAPAY_MERCHANT_KEY')
      .single();

    if (configError || !config?.value) {
      console.error("Config Error:", configError);
      throw new Error("Lỗi cấu hình hệ thống: Không tìm thấy Merchant Key");
    }
    const merchantKey = config.value;

    // 4. Tính toán tổng tiền từ Server (Bảo mật: không tin tưởng giá từ client)
    let totalAmount = 0;
    const orderItemsData = [];
    let descriptionParts = [];

    // Lấy danh sách ID sản phẩm để query 1 lần (tối ưu hơn for loop)
    const itemIds = items.map(i => i.id);
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('*')
      .in('id', itemIds);

    if (productError || !products) {
      throw new Error("Không thể lấy thông tin sản phẩm");
    }

    for (const item of items) {
      const product = products.find(p => p.id === item.id);
      if (!product) continue;

      const lineTotal = product.price * item.quantity;
      totalAmount += lineTotal;

      // Xử lý tên sản phẩm theo ngôn ngữ
      const productName = (language === 'en' && product.title_en) ? product.title_en : product.title;
      descriptionParts.push(`${productName} (x${item.quantity})`);

      orderItemsData.push({
        product_id: product.id,
        quantity: item.quantity,
        price_at_purchase: product.price
      });
    }

    if (totalAmount <= 0) {
      throw new Error("Tổng tiền đơn hàng không hợp lệ");
    }

    // 5. Tạo đơn hàng trong Database (Status: Pending)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        amount: totalAmount,
        customer_email: email,
        customer_name: name,
        contact_method: contactMethod,
        contact_info: contactInfo,
        shipping_address: shippingAddress,
        phone_number: phoneNumber,
        status: 'pending'
      })
      .select()
      .single();

    if (orderError) {
      console.error("Create Order Error:", orderError);
      throw new Error("Không thể tạo đơn hàng: " + orderError.message);
    }

    // 6. Lưu chi tiết đơn hàng (Order Items)
    const itemsToInsert = orderItemsData.map(i => ({ ...i, order_id: order.id }));
    const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
    
    if (itemsError) {
      console.error("Insert Items Error:", itemsError);
      // Không throw error ở đây để vẫn cho phép thanh toán, nhưng log lại để sửa
    }

    // 7. Gọi API OxaPay tạo link thanh toán
    const oxapayPayload = {
      merchant: merchantKey,
      amount: totalAmount,
      currency: 'USDT', // Hoặc lấy từ setting nếu cần
      lifeTime: 60, // Thời gian tồn tại link (phút)
      feePaidByPayer: 0,
      returnUrl: `${req.headers.get('origin')}/success?orderId=${order.id}`,
      callbackUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/oxapay-webhook`,
      orderId: order.id.toString(),
      description: descriptionParts.join(', ').substring(0, 100), // Cắt ngắn nếu quá dài
      email: email
    };

    console.log("Calling OxaPay with:", JSON.stringify(oxapayPayload));

    const oxapayRes = await fetch('https://api.oxapay.com/merchants/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(oxapayPayload)
    });

    const oxapayData = await oxapayRes.json();

    if (oxapayData.result !== 100) {
      console.error("OxaPay Error:", oxapayData);
      throw new Error(oxapayData.message || "Lỗi khởi tạo thanh toán từ OxaPay");
    }

    // 8. Cập nhật TrackID từ OxaPay vào đơn hàng
    await supabase
      .from('orders')
      .update({ oxapay_track_id: oxapayData.trackId })
      .eq('id', order.id);

    // 9. Trả về link thanh toán cho Client
    return new Response(JSON.stringify({ payUrl: oxapayData.payLink }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error("Payment Handler Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400 // Trả về 400 để client biết là lỗi logic, không phải lỗi mạng
    });
  }
});
