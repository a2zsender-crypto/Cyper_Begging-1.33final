import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- HOLE PLACE FOR API ---
async function getKeyFromExternalAPI(productId: any, variantInfo: any): Promise<string> {
    // TODO: Implement Logic gọi API lấy key ở đây
    // Ví dụ: const res = await fetch('https://api.partner.com/get-key', ...);
    console.log(`[API CALL] Getting key for Product ${productId} - Variant: ${JSON.stringify(variantInfo)}`);
    return "API-KEY-DEMO-" + Math.random().toString(36).substring(7).toUpperCase();
}

async function notifyTelegram(message: string) {
    // TODO: Cấu hình Bot Token và Chat ID trong App Config hoặc Environment
    console.log(`[TELEGRAM] ${message}`);
}
// --------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );
    let body;
    try { body = await req.json(); } catch { throw new Error("Body rỗng"); }
    const { items, email, name, contactMethod, contactInfo, shippingAddress, phoneNumber, language } = body;

    if (!items || items.length === 0 || !email) throw new Error("Giỏ hàng trống");
    
    const { data: config } = await supabase.from('app_config').select('*').eq('key', 'OXAPAY_MERCHANT_KEY').single();
    const merchantKey = config?.value;
    if (!merchantKey) throw new Error("Chưa cấu hình Merchant Key");

    let totalAmount = 0;
    const orderItemsData = [];
    let description = "Order: ";

    for (const item of items) {
        const { data: product } = await supabase.from('products').select('*').eq('id', item.id).single();
        if (!product) continue;
        
        let assignedKey = null;
        let isApiSource = false;

        // --- LOGIC XỬ LÝ KHO & KEY ---
        if (product.is_digital) {
            // 1. Tìm key trong kho Local khớp với Variant
            const { data: keyData, error: keyError } = await supabase
                .from('product_keys')
                .select('id, key_value')
                .eq('product_id', product.id)
                .eq('is_used', false)
                .contains('variant_info', item.selectedVariants || {}) // Match variant JSON
                .limit(item.quantity); // Lấy đủ số lượng

            const availableKeys = keyData || [];

            if (availableKeys.length >= item.quantity) {
                // Đủ hàng Local
                assignedKey = availableKeys.map(k => k.key_value).join('\n');
                // Đánh dấu đã dùng
                const ids = availableKeys.map(k => k.id);
                await supabase.from('product_keys').update({ is_used: true }).in('id', ids);
            } else {
                // Thiếu hàng Local -> Check API Flag
                if (product.allow_external_key) {
                    // Gọi API lấy key (Placeholder)
                    const keysNeeded = item.quantity - availableKeys.length;
                    let apiKeys = [];
                    for(let i=0; i<keysNeeded; i++) {
                        apiKeys.push(await getKeyFromExternalAPI(product.id, item.selectedVariants));
                    }
                    
                    // Gộp key local (nếu có) và key API
                    const localKeyStr = availableKeys.map(k => k.key_value).join('\n');
                    assignedKey = localKeyStr ? (localKeyStr + '\n' + apiKeys.join('\n')) : apiKeys.join('\n');
                    isApiSource = true;
                    
                    // Mark local keys used
                    if(availableKeys.length > 0) {
                        await supabase.from('product_keys').update({ is_used: true }).in('id', availableKeys.map(k=>k.id));
                    }

                    // Notify Admin
                    await notifyTelegram(`⚠️ Cảnh báo: Đã dùng Key API cho đơn hàng mới (Kho Local hết hoặc không đủ). SP: ${product.title}`);
                } else {
                    throw new Error(`Sản phẩm "${product.title}" (${JSON.stringify(item.selectedVariants)}) không đủ hàng trong kho!`);
                }
            }
        } else {
             // LOGIC VẬT LÝ (Giữ nguyên hoặc cập nhật trừ kho variant)
             if (product.variant_stocks && product.variant_stocks.length > 0 && item.selectedVariants) {
                 const variantIndex = product.variant_stocks.findIndex((v: any) => {
                     const vOpts = v.options;
                     const sOpts = item.selectedVariants;
                     if (Object.keys(vOpts).length !== Object.keys(sOpts).length) return false;
                     return Object.keys(sOpts).every(k => vOpts[k] === sOpts[k]);
                 });

                 if (variantIndex !== -1) {
                     const currentVarStock = parseInt(product.variant_stocks[variantIndex].stock);
                     if (currentVarStock < item.quantity) throw new Error(`Sản phẩm "${product.title}" hết hàng!`);
                     product.variant_stocks[variantIndex].stock = currentVarStock - item.quantity;
                     
                     const newPhysicalStock = product.variant_stocks.reduce((sum: number, v: any) => sum + (parseInt(v.stock)||0), 0);
                     await supabase.from('products').update({
                         variant_stocks: product.variant_stocks,
                         physical_stock: newPhysicalStock
                     }).eq('id', product.id);
                 }
             } else {
                 if ((product.physical_stock || 0) < item.quantity) throw new Error(`Sản phẩm "${product.title}" hết hàng!`);
                 await supabase.from('products').update({ physical_stock: product.physical_stock - item.quantity }).eq('id', product.id);
             }
        }

        const finalPrice = item.price || product.price;
        const lineTotal = finalPrice * item.quantity;
        totalAmount += lineTotal;

        const productName = (language === 'en' && product.title_en) ? product.title_en : product.title;
        let variantStr = "";
        if (item.selectedVariants && Object.keys(item.selectedVariants).length > 0) {
            const v = Object.values(item.selectedVariants).join('/');
            variantStr = ` [${v}]`;
        }

        description += `${productName}${variantStr} (x${item.quantity}), `;
        
        orderItemsData.push({ 
            product_id: product.id, 
            quantity: item.quantity, 
            price_at_purchase: finalPrice,
            selected_variants: item.selectedVariants || {},
            assigned_key: assignedKey // Lưu key đã cấp (có thể null nếu chờ thanh toán xong mới cấp - Logic này tuỳ bạn, ở đây mình cấp giữ chỗ trước hoặc logic pending)
            // LƯU Ý: Thường thì key chỉ hiện SAU KHI thanh toán thành công. Logic trên đang check stock trước.
            // Nếu muốn "Thanh toán xong mới lấy key API" thì move đoạn gọi API xuống webhook oxapay. 
            // Nhưng check stock thì phải làm ở đây để tránh khách thanh toán xong mà không có hàng (nếu API lỗi).
        });
    }

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

    // Lưu order items (chưa save key vội nếu muốn bảo mật, hoặc save vào cột riêng 'reserved_key')
    const itemsToInsert = orderItemsData.map(i => ({ 
        order_id: order.id,
        product_id: i.product_id,
        quantity: i.quantity,
        price_at_purchase: i.price_at_purchase,
        selected_variants: i.selected_variants,
        // Có thể lưu key vào metadata hoặc bảng riêng nếu muốn gửi sau
    }));
    
    const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
    if (itemsError) throw itemsError;

    // OXAPAY REQUEST
    const oxapayPayload = {
      merchant: merchantKey, 
      amount: totalAmount, 
      currency: 'USDT', 
      lifeTime: 60, 
      feePaidByPayer: 0,
      returnUrl: `${req.headers.get('origin')}/success?orderId=${order.id}`, 
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
    
    await supabase.from('orders').update({ oxapay_track_id: oxapayData.trackId }).eq('id', order.id);

    return new Response(JSON.stringify({ payUrl: oxapayData.payLink }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});