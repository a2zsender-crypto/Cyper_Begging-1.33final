import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OXAPAY_MERCHANT_KEY = Deno.env.get('OXAPAY_MERCHANT_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
    
    // Nhận thêm biến 'language' từ frontend
    const { items, email, name, contactMethod, contactInfo, shippingAddress, phoneNumber, language } = await req.json()

    // 1. Tính tổng tiền và Lấy tên sản phẩm theo ngôn ngữ
    let totalAmount = 0
    let descriptionItems = []

    for (const item of items) {
        const { data: product } = await supabase.from('products').select('*').eq('id', item.id).single()
        if (product) {
            totalAmount += product.price * item.quantity
            
            // LOGIC CHỌN TÊN SẢN PHẨM:
            // Nếu lang là 'en' thì lấy title_en, nếu không có title_en thì lấy title
            const prodName = (language === 'en' && product.title_en) ? product.title_en : product.title
            
            descriptionItems.push(`${prodName} (x${item.quantity})`)
        }
    }

    // 2. Tạo đơn hàng trong Database trước (Status: pending)
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
            customer_email: email,
            customer_name: name,
            amount: totalAmount,
            status: 'pending',
            contact_method: contactMethod,
            contact_info: contactInfo,
            shipping_address: shippingAddress,
            phone_number: phoneNumber
        })
        .select()
        .single()

    if (orderError) throw orderError

    // Lưu chi tiết đơn hàng
    const orderItemsData = items.map((i: any) => ({
        order_id: order.id,
        product_id: i.id,
        quantity: i.quantity,
        // Lưu giá tại thời điểm mua để sau này không bị đổi nếu giá sản phẩm đổi
        price_at_purchase: 0 // Bạn có thể query lại giá để điền vào đây nếu muốn kỹ
    }))
    await supabase.from('order_items').insert(orderItemsData)

    // 3. Gọi API Oxapay để tạo Payment Link
    const desc = `Order: ${descriptionItems.join(', ')}`
    
    const payload = {
        merchant: OXAPAY_MERCHANT_KEY,
        amount: totalAmount,
        currency: 'USDT', // Hoặc để User chọn loại coin nếu muốn
        lifeTime: 30, // Link sống trong 30 phút
        feePaidByPayer: 0,
        underPaidCover: 0,
        callbackUrl: "https://csxuarismehewgiedoeg.supabase.co/functions/v1/oxapay-webhook", // Đổi thành link project của bạn
        returnUrl: "https://autoshoppro.pages.dev/success", // Link quay về khi thanh toán xong
        description: desc,
        orderId: order.id, // Quan trọng: Gửi ID đơn hàng để Webhook biết đơn nào
        email: email
    }

    const oxaRes = await fetch('https://api.oxapay.com/merchants/request', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    })

    const oxaData = await oxaRes.json()

    if (oxaData.result !== 100) {
        throw new Error("Oxapay Error: " + oxaData.message)
    }

    return new Response(JSON.stringify({ payUrl: oxaData.payLink }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
