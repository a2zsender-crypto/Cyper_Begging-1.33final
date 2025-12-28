import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// Cấu hình Resend
const sendEmail = async (to: string, subject: string, html: string) => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'CryptoShop <onboarding@resend.dev>', // Sau này thay bằng domain thật
      to: [to],
      subject: subject,
      html: html,
    }),
  })
  return res.json()
}

serve(async (req) => {
  try {
    // 1. Nhận dữ liệu từ Oxapay
    const body = await req.json()
    const { trackId, status, orderId, price, payAmount, currency } = body

    // LOG để kiểm tra (Xem trong Supabase Dashboard -> Edge Functions -> Logs)
    console.log("Oxapay Webhook received:", body)

    // 2. Chỉ xử lý nếu trạng thái là "Paid" hoặc "Confirming"
    // (Lưu ý: Oxapay có nhiều trạng thái, tùy cấu hình bạn chọn cái nào chốt đơn)
    if (status !== 'Paid' && status !== 'Confirming' && status !== 'Completed') {
        return new Response(JSON.stringify({ message: "Not a success status, ignoring." }), { status: 200 })
    }

    // 3. Kết nối Database quyền Admin (Service Role)
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // 4. Lấy thông tin đơn hàng hiện tại
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*, products(*))')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
        throw new Error("Order not found")
    }

    // Nếu đơn đã xử lý rồi thì bỏ qua để tránh gửi mail 2 lần
    if (order.status === 'paid') {
        return new Response(JSON.stringify({ message: "Order already paid" }), { status: 200 })
    }

    // 5. Cập nhật trạng thái đơn hàng thành PAID
    await supabase.from('orders').update({ status: 'paid', oxapay_track_id: trackId }).eq('id', orderId)

    // 6. Xử lý lấy Key (Nếu là sản phẩm số)
    let emailContent = `<h1>Cảm ơn bạn đã mua hàng!</h1><p>Mã đơn: #${orderId}</p><h3>Sản phẩm của bạn:</h3><ul>`
    
    for (const item of order.order_items) {
        if (item.products.is_digital) {
            // Lấy key chưa dùng từ kho
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

                emailContent += `<li><strong>${item.products.title}:</strong><br/><code style="background:#eee;padding:5px;display:block;margin:5px 0;">${keyValues}</code></li>`
            } else {
                emailContent += `<li><strong>${item.products.title}:</strong> (Hết kho - Admin sẽ liên hệ lại)</li>`
            }
        } else {
            emailContent += `<li><strong>${item.products.title}:</strong> (Sản phẩm vật lý - Đang chuẩn bị giao)</li>`
        }
    }
    emailContent += "</ul><p>Nếu cần hỗ trợ, vui lòng liên hệ Telegram.</p>"

    // 7. Gửi Email cho khách
    if (order.customer_email) {
        await sendEmail(order.customer_email, `[CryptoShop] Đơn hàng #${orderId} Thành công`, emailContent)
    }

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})