import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Cấu hình CORS Header để cho phép frontend gọi function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Xử lý Preflight Request (OPTIONS) - Khắc phục lỗi CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Lấy dữ liệu từ Frontend gửi lên
    const { amount, orderId, email, ...extraData } = await req.json()

    // Kiểm tra dữ liệu đầu vào cơ bản
    if (!amount) {
      throw new Error("Missing amount")
    }

    // 3. Cấu hình Payload gửi sang OxaPay
    // Lưu ý: Lấy Merchant Key từ biến môi trường Supabase
    const oxapayPayload = {
      merchant: Deno.env.get('OXAPAY_MERCHANT_KEY'),
      amount: amount,
      lifeTime: 30, // Thời gian tồn tại của invoice (phút)
      feePaidByPayer: 0,
      underPaidCover: 0,
      callbackUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/oxapay-webhook`,
      returnUrl: `${req.headers.get('origin')}/success`, // Chuyển hướng về trang Success của web
      description: `Order #${orderId || 'General'}`,
      orderId: orderId,
      email: email,
      ...extraData
    }

    console.log("Sending request to OxaPay:", oxapayPayload)

    // 4. Gọi API OxaPay
    const response = await fetch('https://api.oxapay.com/merchants/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(oxapayPayload),
    })

    const data = await response.json()

    // Kiểm tra phản hồi từ OxaPay
    if (data.result !== 100) {
      throw new Error(data.message || "OxaPay API Error")
    }

    // 5. Trả về kết quả thành công (chứa link thanh toán)
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    // 6. Xử lý lỗi: Trả về JSON lỗi thay vì để Function crash (Khắc phục lỗi non-2xx)
    console.error("Payment Handler Error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
