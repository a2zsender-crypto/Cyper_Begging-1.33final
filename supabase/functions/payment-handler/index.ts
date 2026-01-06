import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- GIẢ LẬP GỌI API LẤY KEY NGOÀI (HOLE PLACE) ---
async function getKeyFromExternalAPI(productId: any, variantInfo: any): Promise<string> {
    // TODO: Viết code gọi API thật ở đây
    console.log(`[API CALL] Getting key for Product ${productId} - Variant: ${JSON.stringify(variantInfo)}`);
    return "API-KEY-" + Math.random().toString(36).substring(7).toUpperCase();
}

async function notifyTelegram(message: string) {
    // TODO: Cấu hình Bot Token
    console.log(`[TELEGRAM] ${message}`);
}
// --------------------------------------------------

serve(async (req) => {
  // Xử lý CORS Preflight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    let body;
    try { body = await req.json(); } catch { throw new Error("Dữ liệu gửi lên không hợp lệ (Body rỗng)"); }
    
    const { items, email, name, contactMethod, contactInfo, shippingAddress, phoneNumber, language } = body;

    if (!items || !Array.isArray(items) || items.length === 0) throw new Error("Giỏ hàng trống.");
    if (!email) throw new Error("Vui lòng cung cấp Email.");

    // 1. LẤY MERCHANT KEY
    const { data: config } = await supabase.from('app_config').select('*').eq('key', 'OXAPAY_MERCHANT_KEY').single();
    const merchantKey = config?.value;
    
    // Nếu chưa cấu hình Key, báo lỗi rõ ràng thay vì crash
    if (!merchantKey) throw new Error("Lỗi hệ thống: Chưa cấu hình Oxapay Merchant Key.");

    let totalAmount = 0;
    const orderItemsData = [];
    let description = "Order: ";

    // 2. DUYỆT TỪNG SẢN PHẨM TRONG GIỎ
    for (const item of items) {
        const { data: product } = await supabase.from('products').select('*').eq('id', item.id).single();
        
        if (!product) throw new Error(`Sản phẩm ID ${item.id} không tồn tại.`);

        let assignedKey = null;

        // --- A. XỬ LÝ SẢN PHẨM SỐ (DIGITAL) ---
        if (product.is_digital) {
            // Tìm key trong kho Local khớp với Variant
            // Sử dụng .contains cho JSONB. Lưu ý: variant_info trong DB phải là JSON object.
            const { data: keyData, error: keyError } = await supabase
                .from('product_keys')
                .select('id, key_value')
                .eq('product_id', product.id)
                .eq('is_used', false)
                .contains('variant_info', item.selectedVariants || {}) 
                .limit(item.quantity);

            if (keyError) {
                console.error("Lỗi query key:", keyError);
                throw new Error("Lỗi hệ thống khi kiểm tra kho key.");
            }

            const availableKeys = keyData || [];

            // Nếu đủ key local
            if (availableKeys.length >= item.quantity) {
                assignedKey = availableKeys.map(k => k.key_value).join('\n');
                // Đánh dấu đã dùng
                const ids = availableKeys.map(k => k.id);
                await supabase.from('product_keys').update({ is_used: true }).in('id', ids);
            } 
            // Nếu thiếu hàng Local -> Check cờ cho phép lấy API
            else {
                if (product.allow_external_key) {
                    const keysNeeded = item.quantity - availableKeys.length;
                    let apiKeys = [];
                    for(let i=0; i<keysNeeded; i++) {
                        apiKeys.push(await getKeyFromExternalAPI(product.id, item.selectedVariants));
                    }
                    
                    // Gộp key local (nếu có) và key API
                    const localKeyStr = availableKeys.map(k => k.key_value).join('\n');
                    assignedKey = localKeyStr ? (localKeyStr + '\n' + apiKeys.join('\n')) : apiKeys.join('\n');
                    
                    // Đánh dấu key local là đã dùng
                    if(availableKeys.length > 0) {
                        await supabase.from('product_keys').update({ is_used: true }).in('id', availableKeys.map(k=>k.id));
                    }

                    await notifyTelegram(`⚠️ Cảnh báo: Đã dùng Key API cho đơn hàng mới. SP: ${product.title}`);
                } else {
                    // Nếu không cho phép API -> Báo hết hàng
                    const variantStr = item.selectedVariants && Object.keys(item.selectedVariants).length > 0 
                        ? ` (${Object.values(item.selectedVariants).join(', ')})` 
                        : '';
                    throw new Error(`Sản phẩm "${product.title}"${variantStr} không đủ số lượng trong kho!`);
                }
            }
        } 
        // --- B. XỬ LÝ SẢN PHẨM VẬT LÝ (PHYSICAL) ---
        else {
             // Kiểm tra xem sản phẩm có biến thể không
             const hasVariantsInDB = product.variant_stocks && Array.isArray(product.variant_stocks) && product.variant_stocks.length > 0;
             const hasSelectedVariant = item.selectedVariants && Object.keys(item.selectedVariants).length > 0;

             if (hasVariantsInDB && hasSelectedVariant) {
                 // Tìm đúng biến thể trong mảng variant_stocks
                 const variantIndex = product.variant_stocks.findIndex((v: any) => {
                     const vOpts = v.options;
                     const sOpts = item.selectedVariants;
                     // So sánh deep object đơn giản
                     if (Object.keys(vOpts).length !== Object.keys(sOpts).length) return false;
                     return Object.keys(sOpts).every(k => vOpts[k] === sOpts[k]);
                 });

                 if (variantIndex === -1) {
                     // Trường hợp khách gửi variant không tồn tại (Hack hoặc lỗi frontend)
                     throw new Error(`Phiên bản sản phẩm "${product.title}" bạn chọn không tồn tại.`);
                 }

                 const currentVarStock = parseInt(product.variant_stocks[variantIndex].stock || 0);
                 
                 if (currentVarStock < item.quantity) {
                     throw new Error(`Sản phẩm "${product.title}" (Phiên bản này) đã hết hàng.`);
                 }
                 
                 // Trừ kho variant
                 product.variant_stocks[variantIndex].stock = currentVarStock - item.quantity;
                 
                 // Tính lại tổng kho physical_stock
                 const newPhysicalStock = product.variant_stocks.reduce((sum: number, v: any) => sum + (parseInt(v.stock)||0), 0);
                 
                 // Cập nhật DB
                 await supabase.from('products').update({
                     variant_stocks: product.variant_stocks,
                     physical_stock: newPhysicalStock
                 }).eq('id', product.id);

             } else {
                 // Logic cũ: Trừ kho tổng (cho sản phẩm không biến thể)
                 const currentStock = product.physical_stock || 0;
                 if (currentStock < item.quantity) {
                     throw new Error(`Sản phẩm "${product.title}" không đủ số lượng.`);
                 }
                 await supabase.from('products').update({ 
                     physical_stock: currentStock - item.quantity 
                 }).eq('id', product.id);
             }
        }

        // TÍNH TIỀN
        const finalPrice = item.price || product.price; // Giá đã bao gồm variant price từ frontend
        const lineTotal = finalPrice * item.quantity;
        totalAmount += lineTotal;

        // Tạo mô tả cho Oxapay
        const productName = (language === 'en' && product.title_en) ? product.title_en : product.title;
        let variantStr = "";
        if (item.selectedVariants && Object.keys(item.selectedVariants).length > 0) {
            const v = Object.values(item.selectedVariants).join('/');
            variantStr = ` [${v}]`;
        }
        description += `${productName}${variantStr} (x${item.quantity}), `;
        
        // Chuẩn bị data để insert vào order_items
        orderItemsData.push({ 
            product_id: product.id, 
            quantity: item.quantity, 
            price_at_purchase: finalPrice,
            selected_variants: item.selectedVariants || {},
            assigned_key: assignedKey 
        });
    }

    // 3. TẠO ORDER
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

    if (orderError) throw new Error("Không thể tạo đơn hàng: " + orderError.message);

    // 4. LƯU CHI TIẾT ĐƠN HÀNG (Order Items)
    const itemsToInsert = orderItemsData.map(i => ({ 
        order_id: order.id,
        product_id: i.product_id,
        quantity: i.quantity,
        price_at_purchase: i.price_at_purchase,
        selected_variants: i.selected_variants,
        // Nếu muốn bảo mật key, có thể chưa lưu assigned_key ở đây mà gửi qua mail sau
    }));
    
    const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
    if (itemsError) throw new Error("Không thể lưu chi tiết đơn hàng.");

    // 5. GỌI QUA OXAPAY
    const oxapayPayload = {
      merchant: merchantKey, 
      amount: totalAmount, // Oxapay hỗ trợ số hoặc string
      currency: 'USDT', 
      lifeTime: 60, 
      feePaidByPayer: 0,
      returnUrl: `${req.headers.get('origin')}/success?orderId=${order.id}`, 
      callbackUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/oxapay-webhook`,
      orderId: order.id.toString(), 
      description: description.substring(0, 100), // Cắt ngắn nếu quá dài
      email: email
    };

    console.log("Calling Oxapay with:", JSON.stringify(oxapayPayload));

    const oxapayRes = await fetch('https://api.oxapay.com/merchants/request', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(oxapayPayload) 
    });
    
    const oxapayData = await oxapayRes.json();
    
    if (oxapayData.result !== 100) {
        // Log lỗi từ Oxapay để debug
        console.error("Oxapay Error:", oxapayData);
        throw new Error("Lỗi từ cổng thanh toán Oxapay: " + (oxapayData.message || "Unknown error"));
    }
    
    // Cập nhật track_id
    await supabase.from('orders').update({ oxapay_track_id: oxapayData.trackId }).eq('id', order.id);

    // 6. TRẢ VỀ LINK THANH TOÁN
    return new Response(JSON.stringify({ payUrl: oxapayData.payLink }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error("Payment Handler Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
