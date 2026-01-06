import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- HOLE PLACE FOR API ---
async function getKeyFromExternalAPI(productId: any, variantInfo: any): Promise<string> {
    // [HOLE PLACE] Logic gọi API bên thứ 3 để lấy key
    // Ví dụ: const res = await fetch('https://partner.com/api/get-key', ...);
    console.log(`[API CALL] Getting key for Product ${productId} - Variant: ${JSON.stringify(variantInfo)}`);
    
    // Giả lập trả về key (Bạn sẽ thay thế bằng code thật sau này)
    return "API-KEY-" + Math.random().toString(36).substring(7).toUpperCase();
}

async function notifyTelegram(message: string) {
    // [HOLE PLACE] Gửi thông báo Telegram
    // Cần đảm bảo không crash app nếu chưa cấu hình token
    try {
        const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
        const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
        if (token && chatId) {
            // await fetch(...) 
            console.log(`[TELEGRAM SENT]: ${message}`);
        } else {
            console.log(`[TELEGRAM LOG]: ${message}`);
        }
    } catch (e) {
        console.error("Telegram Error (Ignored):", e);
    }
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

        // --- LOGIC XỬ LÝ KHO & KEY ---
        if (product.is_digital) {
            // 1. Tìm key trong kho Local khớp với Variant
            // Lưu ý: Nếu selectedVariants là {} (rỗng), ta vẫn query bình thường. 
            // product_keys.variant_info nên được default là {} trong DB.
            const { data: keyData, error: keyError } = await supabase
                .from('product_keys')
                .select('id, key_value')
                .eq('product_id', product.id)
                .eq('is_used', false)
                .contains('variant_info', item.selectedVariants || {}) 
                .limit(item.quantity);

            const availableKeys = keyData || [];

            if (availableKeys.length >= item.quantity) {
                // CASE A: Đủ hàng trong kho Local
                assignedKey = availableKeys.map(k => k.key_value).join('\n');
                
                // Đánh dấu đã dùng
                const ids = availableKeys.map(k => k.id);
                await supabase.from('product_keys').update({ is_used: true }).in('id', ids);
            } else {
                // CASE B: Thiếu hàng Local -> Check xem có cho phép lấy API không
                if (product.allow_external_key) {
                    const keysNeeded = item.quantity - availableKeys.length;
                    let apiKeys = [];
                    
                    // Gọi hàm Hole Place để lấy key
                    for(let i=0; i<keysNeeded; i++) {
                        const newKey = await getKeyFromExternalAPI(product.id, item.selectedVariants);
                        apiKeys.push(newKey);
                    }
                    
                    // Gộp key local (nếu có ít) và key API
                    const localKeyStr = availableKeys.map(k => k.key_value).join('\n');
                    assignedKey = localKeyStr ? (localKeyStr + '\n' + apiKeys.join('\n')) : apiKeys.join('\n');
                    
                    // Đánh dấu số key local ít ỏi kia là đã dùng
                    if(availableKeys.length > 0) {
                        await supabase.from('product_keys').update({ is_used: true }).in('id', availableKeys.map(k=>k.id));
                    }

                    // Báo động cho Admin biết đang phải dùng API
                    await notifyTelegram(`⚠️ Cảnh báo: Đã dùng Key API cho đơn hàng mới. SP: ${product.title} - Variant: ${JSON.stringify(item.selectedVariants)}`);
                } else {
                    // CASE C: Không đủ hàng và Không cho phép API -> Lỗi
                    throw new Error(`Sản phẩm "${product.title}" (${JSON.stringify(item.selectedVariants)}) không đủ hàng trong kho!`);
                }
            }
        } else {
             // LOGIC SẢN PHẨM VẬT LÝ
             // Fix Crash: Thêm ( || []) để tránh lỗi nếu variant_stocks là null
             const variantStocks = product.variant_stocks || [];
             
             if (variantStocks.length > 0 && item.selectedVariants) {
                 const variantIndex = variantStocks.findIndex((v: any) => {
                     const vOpts = v.options;
                     const sOpts = item.selectedVariants;
                     // So sánh 2 object options
                     if (Object.keys(vOpts).length !== Object.keys(sOpts).length) return false;
                     return Object.keys(sOpts).every(k => vOpts[k] === sOpts[k]);
                 });

                 if (variantIndex !== -1) {
                     const currentVarStock = parseInt(variantStocks[variantIndex].stock);
                     if (currentVarStock < item.quantity) throw new Error(`Sản phẩm "${product.title}" hết hàng biến thể này!`);
                     
                     // Trừ kho
                     variantStocks[variantIndex].stock = currentVarStock - item.quantity;
                     
                     // Tính lại tổng kho vật lý
                     const newPhysicalStock = variantStocks.reduce((sum: number, v: any) => sum + (parseInt(v.stock)||0), 0);
                     
                     await supabase.from('products').update({
                         variant_stocks: variantStocks,
                         physical_stock: newPhysicalStock
                     }).eq('id', product.id);
                 }
             } else {
                 // Không có biến thể -> Trừ kho tổng
                 if ((product.physical_stock || 0) < item.quantity) throw new Error(`Sản phẩm "${product.title}" hết hàng!`);
                 await supabase.from('products').update({ physical_stock: product.physical_stock - item.quantity }).eq('id', product.id);
             }
        }

        // Tính tiền (Đảm bảo kiểu số)
        const finalPrice = parseFloat(item.price) || product.price;
        const lineTotal = finalPrice * item.quantity;
        totalAmount += lineTotal;

        const productName = (language === 'en' && product.title_en) ? product.title_en : product.title;
        let variantStr = "";
        if (item.selectedVariants && Object.keys(item.selectedVariants).length > 0) {
            const v = Object.values(item.selectedVariants).join('/');
            variantStr = ` [${v}]`;
        }

        description += `${productName}${variantStr} (x${item.quantity}), `;
        
        // Push dữ liệu đã xử lý vào mảng tạm
        orderItemsData.push({ 
            product_id: product.id, 
            quantity: item.quantity, 
            price_at_purchase: finalPrice,
            selected_variants: item.selectedVariants || {},
            assigned_key: assignedKey // QUAN TRỌNG: Key đã lấy được
        });
    }

    // TẠO ĐƠN HÀNG (PENDING)
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

    // LƯU ORDER ITEMS (BAO GỒM CẢ KEY)
    const itemsToInsert = orderItemsData.map(i => ({ 
        order_id: order.id,
        product_id: i.product_id,
        quantity: i.quantity,
        price_at_purchase: i.price_at_purchase,
        selected_variants: i.selected_variants,
        assigned_key: i.assigned_key // FIX: Lưu key vào DB
    }));
    
    const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
    if (itemsError) throw itemsError;

    // GỌI QUA OXAPAY
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
    console.error("Payment Handler Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});