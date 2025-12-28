import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const sendEmail = async (to: string, subject: string, html: string) => {
  if (!RESEND_API_KEY) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'AutoShop <onboarding@resend.dev>', // Sau này thay bằng domain verify của bạn
      to: [to],
      subject: subject,
      html: html,
    }),
  })
}

serve(async (req) => {
  try {
    // 1. QUAN TRỌNG: Đọc dữ liệu dạng JSON (Sửa lỗi "Body can not be decoded...")
    const body = await req.json()
    console.log("Webhook received:", body) // Xem log trên Supabase Dashboard

    // Lấy các trường quan trọng từ Oxapay
    const { status, orderId, trackId } = body

    // 2. Chỉ xử lý khi trạng thái là Paid/Completed
    // Oxapay có thể gửi: "Paid", "Confirming", "Expired"...
    if (status !== 'Paid' && status !== 'Completed') {
        return new Response(JSON.stringify({ message: "Not paid yet" }), { status: 200 })
    }

    // 3. Kết nối Database với quyền Admin (Service Role)
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // 4. Tìm đơn hàng
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*, products(*))')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
        console.error("Order not found:", orderId)
        return new Response(JSON.stringify({ error: "Order not found" }), { status: 404 })
    }

    // Nếu đơn đã xử lý rồi thì thôi
    if (order.status === 'paid') {
        return new Response(JSON.stringify({ message: "Already processed" }), { status: 200 })
    }

    // 5. Cập nhật trạng thái đơn hàng -> PAID
    await supabase.from('orders').update({ 
        status: 'paid', 
        oxapay_track_id: trackId 
    }).eq('id', orderId)

    // 6. Xử lý gửi Key (Logic gửi hàng)
    let emailContent = `<h1>Thanh toán thành công! / Payment Successful!</h1>
                        <p>Order ID: #${orderId}</p>
                        <h3>Sản phẩm của bạn / Your Products:</h3><ul>`
    
    for (const item of order.order_items) {
        if (item.products.is_digital) {
            // Lấy key chưa dùng
            const { data: keys } = await supabase
                .from('product_keys')
                .select('*')
                .eq('product_id', item.products.id)
                .eq('is_used', false)
                .limit(item.quantity)
            
            if (keys && keys.length > 0) {
                const keyValues = keys.map((k: any) => k.key_value).join('<br/>')
                
                // Đánh dấu key đã dùng
                const keyIds = keys.map((k: any) => k.id)
                await supabase.from('product_keys').update({ 
                    is_used: true, 
                    used_by_order_id: orderId 
                }).in('id', keyIds)

                emailContent += `<li><strong>${item.products.title}:</strong><br/>
                                 <code style="background:#f4f4f4;padding:10px;display:block;margin:5px 0;border-radius:5px;">${keyValues}</code></li>`
            } else {
                emailContent += `<li><strong>${item.products.title}:</strong> (Hết kho - Admin sẽ liên hệ / Out of Stock - Contact Admin)</li>`
            }
        } else {
            emailContent += `<li><strong>${item.products.title}:</strong> (Sản phẩm vật lý - Đang giao / Physical Item - Shipping soon)</li>`
        }
    }
    emailContent += "</ul><p>Thank you for buying at AutoShop!</p>"

    // 7. Gửi mail
    if (order.customer_email) {
        await sendEmail(order.customer_email, `[AutoShop] Order #${orderId} Completed`, emailContent)
    }

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } })

  } catch (error) {
    console.error("Webhook Error:", error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
