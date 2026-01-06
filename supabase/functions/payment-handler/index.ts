import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- API & NOTIFY FUNCTIONS ---
async function getKeyFromExternalAPI(productId: any, variantInfo: any): Promise<string> {
    console.log(`[API CALL] Getting key for Product ${productId}`);
    return "API-KEY-DEMO-" + Math.random().toString(36).substring(7).toUpperCase();
}
async function notifyTelegram(message: string) {
    console.log(`[TELEGRAM] ${message}`);
}
// ------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );
    
    // XỬ LÝ BODY AN TOÀN HƠN
    let body;
    try { 
        body = await req.json(); 
    } catch (e) { 
        console.error("JSON Parse Error:", e);
        return new Response(JSON.stringify({ error: "Invalid Request Body", details: e.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { items, email, name, contactMethod, contactInfo, shippingAddress, phoneNumber, language } = body;
    if (!items || items.length === 0 || !email) throw new Error("Giỏ hàng trống hoặc thiếu Email");
    
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

        if (product.is_digital) {
            // Tìm key local
            const { data: keyData } = await supabase
                .from('product_keys')
                .select('id, key_value')
                .eq('product_id', product.id)
                .eq('is_used', false)
                .contains('variant_info', item.selectedVariants || {})
                .limit(item.quantity);

            const availableKeys = keyData || [];

            if (availableKeys.length >= item.quantity) {
                assignedKey = availableKeys.map(k => k.key_value).join('\n');
                await supabase.from('product_keys').update({ is_used: true }).in('id', availableKeys.map(k => k.id));
            } else {
                // Thiếu hàng -> Check API
                if (product.allow_external_key) {
                    const keysNeeded = item.quantity - availableKeys.length;
                    let apiKeys = [];
                    for(let i=0; i<keysNeeded; i++) {
                        apiKeys.push(await getKeyFromExternalAPI(product.id, item.selectedVariants));
                    }
                    const localKeyStr = availableKeys.map(k => k.key_value).join('\n');
                    assignedKey = localKeyStr ? (localKeyStr + '\n' + apiKeys.join('\n')) : apiKeys.join('\n');
                    
                    if(availableKeys.length > 0) await supabase.from('product_keys').update({ is_used: true }).in('id', availableKeys.map(k=>k.id));
                    await notifyTelegram(`⚠️ Dùng Key API cho đơn hàng mới. SP: ${product.title}`);
                } else {
                    throw new Error(`Sản phẩm "${product.title}" không đủ hàng!`);
                }
            }
        } else {
             // Logic Vật lý
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
                     await supabase.from('products').update({ variant_stocks: product.variant_stocks, physical_stock: newPhysicalStock }).eq('id', product.id);
                 }
             } else {
                 if ((product.physical_stock || 0) < item.quantity) throw new Error(`Sản phẩm "${product.title}" hết hàng!`);
                 await supabase.from('products').update({ physical_stock: product.physical_stock - item.quantity }).eq('id', product.id);
             }
        }

        const finalPrice = item.price || product.price;
        totalAmount += finalPrice * item.quantity;
        const productName = (language === 'en' && product.title_en) ? product.title_en : product.title;
        let variantStr = item.selectedVariants && Object.keys(item.selectedVariants).length > 0 ? ` [${Object.values(item.selectedVariants).join('/')}]` : "";
        description += `${productName}${variantStr} (x${item.quantity}), `;
        
        orderItemsData.push({ 
            product_id: product.id, quantity: item.quantity, price_at_purchase: finalPrice,
            selected_variants: item.selectedVariants || {}, assigned_key: assignedKey 
        });
    }

    const { data: order, error: orderError } = await supabase.from('orders').insert({
        amount: totalAmount, customer_email: email, customer_name: name, 
        contact_method: contactMethod, contact_info: contactInfo, 
        shipping_address: shippingAddress, phone_number: phoneNumber, status: 'pending'
    }).select().single();

    if (orderError) throw orderError;

    const itemsToInsert = orderItemsData.map(i => ({ 
        order_id: order.id, product_id: i.product_id, quantity: i.quantity,
        price_at_purchase: i.price_at_purchase, selected_variants: i.selected_variants,
        assigned_key: i.assigned_key // Lưu key
    }));
    const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
    if (itemsError) throw itemsError;

    // OXAPAY
    const oxapayPayload = {
      merchant: merchantKey, amount: totalAmount, currency: 'USDT', lifeTime: 60, feePaidByPayer: 0,
      returnUrl: `${req.headers.get('origin')}/success?orderId=${order.id}`, 
      callbackUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/oxapay-webhook`,
      orderId: order.id.toString(), description: description.substring(0, 100), email: email
    };

    const oxapayRes = await fetch('https://api.oxapay.com/merchants/request', { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(oxapayPayload) 
    });
    const oxapayData = await oxapayRes.json();
    if (oxapayData.result !== 100) throw new Error(oxapayData.message || "Lỗi Oxapay");
    await supabase.from('orders').update({ oxapay_track_id: oxapayData.trackId }).eq('id', order.id);

    return new Response(JSON.stringify({ payUrl: oxapayData.payLink }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});