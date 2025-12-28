import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // QUAN TRỌNG: Đọc body là JSON (Sửa lỗi "Body can not be decoded...")
    const body = await req.json()
    console.log("Webhook received:", body)

    // Lấy thông tin từ Oxapay gửi về
    const { status, orderId, trackId } = body

    // Kiểm tra trạng thái
    if (status !== 'Paid' && status !== 'Completed' && status !== 'Confirming') {
        return new Response(JSON.stringify({ message: "Not paid yet" }), { status: 200 })
    }

    // Kết nối DB với quyền Admin (service_role) để update được đơn hàng
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Update trạng thái đơn hàng thành PAID
    const { error } = await supabase
        .from('orders')
        .update({ status: 'paid', oxapay_track_id: trackId })
        .eq('id', orderId)

    if (error) throw error

    // --- ĐOẠN NÀY LÀ LOGIC GỬI MAIL/TELEGRAM NẾU BẠN MUỐN THÊM SAU ---
    // (Hiện tại chỉ cần update status để Admin thấy màu xanh là được)

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } })

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
