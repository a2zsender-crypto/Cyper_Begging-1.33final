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

    // Lấy thông tin sản phẩm từ DB để đối chiếu
    const itemIds = items.map(i => i.id);
    const { data: products } = await supabase.from('products').select('*').in('id', itemIds);

    if (!products) throw new Error("Lỗi lấy dữ liệu sản phẩm");

    for (const item of items) {
      const product = products.find(p => p.id === item.id);
      if (!product) continue;

      // --- LOGIC GIÁ & TÊN (ĐÃ SỬA) ---
      let unitPrice = product.price;

      // 1. Dùng giá từ Client nếu có (để hỗ trợ biến thể giá cao hơn)
      if (item.price && parseFloat(item.price) !== product.price) {
          console.log(`Product ${product.id}: Base ${product.price}, Variant Price: ${item.price}`);
          unitPrice = parseFloat(item.price);
      }

      const lineTotal = unitPrice * item.quantity;
      totalAmount += lineTotal;

      // 2. Tên hiển thị: ƯU TIÊN tên từ Frontend gửi lên (vì đã ghép biến thể)
      // Nếu không có thì fallback về logic cũ
      const baseName = (language === 'en' && product.title_en) ? product.title_en : product.title;
      const displayName = item.name || baseName;

      // Thêm vào mô tả cho OxaPay (Fix lỗi OxaPay thiếu biến thể)
      descriptionParts.push(`${displayName} ($${unitPrice} x${item.quantity})`);

      // 3. Chuẩn bị dữ liệu lưu vào DB (Cố gắng lưu tên đầy đủ cho Admin Panel)
      orderItemsData.push({
        product_id: product.id,
        quantity: item.quantity,
        price_at_purchase: unitPrice,
        // Lưu tên đầy đủ (biến thể) vào cột name hoặc product_name nếu bảng có hỗ trợ
        // Điều này giúp Admin Panel hiển thị đúng "Viettel... 200k" thay vì chỉ "Viettel..."
        name: displayName, 
        product_name: displayName // Backup trường hợp DB dùng cột này
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
    // Lưu ý: Nếu DB của bạn chưa có cột 'name' hay 'product_name' trong bảng order_items,
    // Supabase sẽ tự động bỏ qua các trường thừa hoặc báo lỗi tuỳ config. 
    // Tuy nhiên, logic này là cần thiết để Admin hiển thị đúng.
    const itemsToInsert = orderItemsData.map(i => ({ 
        order_id: order.id,
        product_id: i.product_id,
        quantity: i.quantity,
        price_at_purchase: i.price_at_purchase,
        // Cố gắng lưu tên biến thể
        product_name: i.product_name 
    }));
    
    // Thực hiện Insert items
    const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
    
    // Nếu lỗi insert do thừa cột (DB chưa update), ta fallback về insert cơ bản
    if (itemsError) {
        console.warn("Lỗi lưu chi tiết (có thể do thừa cột name), thử lưu cơ bản:", itemsError.message);
        const basicItems = orderItemsData.map(i => ({
             order_id: order.id,
             product_id: i.product_id,
             quantity: i.quantity,
             price_at_purchase: i.price_at_purchase
        }));
        await supabase.from('order_items').insert(basicItems);
    }

    // Gọi OxaPay (Sử dụng descriptionParts đã ghép tên đầy đủ)
    const oxapayPayload = {
      merchant: merchantKey,
      amount: totalAmount,
      currency: 'USDT',
      lifeTime: 60,
      returnUrl: `${req.headers.get('origin')}/success?orderId=${order.id}`,
      callbackUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/oxapay-webhook`,
      orderId: order.id.toString(),
      description: descriptionParts.join(', ').substring(0, 100), // Tên đầy đủ sẽ hiện ở đây
      email: email
    };

    console.log("Sending to OxaPay:", JSON.stringify(oxapayPayload));

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
