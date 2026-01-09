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

      const baseName = (language === 'en' && product.title_en) ? product.title_en : product.title;
      const finalDisplayName = item.name || baseName;

      descriptionParts.push(`${finalDisplayName} ($${unitPrice} x${item.quantity})`);

      orderItemsData.push({
        product_id: product.id,
        quantity: item.quantity,
        price_at_purchase: unitPrice,
        name: finalDisplayName,
        product_name: finalDisplayName
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

    const itemsToInsert = orderItemsData.map(i => ({ 
        order_id: order.id,
        product_id: i.product_id,
        quantity: i.quantity,
        price_at_purchase: i.price_at_purchase,
        product_name: i.product_name 
    }));
    
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

    // --- SỬA ĐỔI QUAN TRỌNG THEO DOCS ---
    const oxapayPayload = {
      amount: totalAmount,
      currency: 'USDT',
      life_time: 60,
      fee_paid_by_payer: 0,
      under_paid_cover: 0,
      return_url: `${req.headers.get('origin')}/success?orderId=${order.id}`,
      callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/oxapay-webhook`,
      order_id: order.id.toString(),
      description: descriptionParts.join(', ').substring(0, 100),
      email: email,
      sandbox: true // Sandbox Mode
    };

    console.log("Sending to OxaPay v1 (Invoice):", JSON.stringify(oxapayPayload));

    // 1. Sửa Endpoint thành /invoice
    const oxapayRes = await fetch('https://api.oxapay.com/v1/payment/invoice', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        // 2. Sửa Header key thành 'merchant_api_key' (underscore)
        'merchant_api_key': merchantKey 
      },
      body: JSON.stringify(oxapayPayload)
    });

    const oxapayData = await oxapayRes.json();
    console.log("OxaPay Response:", oxapayData);

    if (oxapayData.status !== 200) {
      throw new Error(oxapayData.message || "Lỗi khởi tạo thanh toán OxaPay");
    }
    
    const { track_id, payment_url } = oxapayData.data;

    await supabase.from('orders').update({ oxapay_track_id: track_id }).eq('id', order.id);

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
