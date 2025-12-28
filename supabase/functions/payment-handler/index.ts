// Setup: Deno server (Môi trường chạy của Supabase Edge Functions)
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

  // Khởi tạo Supabase Admin Client (để đọc config bảo mật)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const url = new URL(req.url);
  
  // --- CHỨC NĂNG 1: TẠO GIAO DỊCH (Frontend gọi cái này) ---
  if (url.pathname.endsWith('/create-checkout')) {
    try {
      const { productId, email } = await req.json();

      // 1. Lấy thông tin sản phẩm
      const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();
      if (!product) throw new Error("Sản phẩm không tồn tại");

      // 2. Lấy Merchant Key từ Database Config
      const { data: config } = await supabase.from('app_config').select('*').eq('key', 'OXAPAY_MERCHANT_KEY').single();
      const merchantKey = config?.value;

      if (!merchantKey) throw new Error("Chưa cấu hình Oxapay Merchant Key");

      // 3. Tạo đơn hàng draft trong DB
      const { data: order, error: orderError } = await supabase.from('orders').insert({
        product_id: productId,
        amount: product.price,
        customer_email: email,
        status: 'pending'
      }).select().single();

      if (orderError) throw orderError;

      // 4. Gọi API Oxapay tạo Invoice
      const oxapayPayload = {
        merchant: merchantKey,
        amount: product.price,
        currency: 'USDT', // Hoặc coin bạn muốn
        lifeTime: 30, // Thời gian sống của invoice (phút)
        feePaidByPayer: 0,
        returnUrl: `https://YOUR_WEBSITE_URL/success`, // Sửa thành domain thật của bạn
        callbackUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-handler/webhook`, // Webhook về chính function này
        orderId: order.id.toString(),
        description: `Mua ${product.title}`
      };

      const oxapayRes = await fetch('https://api.oxapay.com/merchants/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(oxapayPayload)
      });
      
      const oxapayData = await oxapayRes.json();
      
      if (oxapayData.result !== 100) {
        throw new Error(oxapayData.message || "Lỗi tạo Oxapay Invoice");
      }

      // 5. Update trackId vào order
      await supabase.from('orders').update({ oxapay_track_id: oxapayData.trackId }).eq('id', order.id);

      return new Response(JSON.stringify({ payUrl: oxapayData.payLink }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // --- CHỨC NĂNG 2: WEBHOOK (Oxapay gọi cái này khi khách trả tiền) ---
  if (url.pathname.endsWith('/webhook')) {
    try {
      const formData = await req.formData(); // Oxapay gửi dạng form-data
      const status = formData.get('status');
      const orderId = formData.get('orderId');
      const trackId = formData.get('trackId');
      
      // Kiểm tra trạng thái thanh toán thành công
      if (status === 'Paid' || status === 'Complete') {
        
        // 1. Cập nhật DB
        await supabase.from('orders').update({ status: 'paid' }).eq('id', orderId);

        // 2. Lấy Config Telegram
        const { data: configs } = await supabase.from('app_config').select('*').in('key', ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']);
        const botToken = configs.find(c => c.key === 'TELEGRAM_BOT_TOKEN')?.value;
        const chatId = configs.find(c => c.key === 'TELEGRAM_CHAT_ID')?.value;

        // 3. Lấy thông tin đơn hàng để gửi tin nhắn
        const { data: order } = await supabase.from('orders').select('*, products(title)').eq('id', orderId).single();

        // 4. Gửi tin nhắn Telegram
        if (botToken && chatId && order) {
          const message = `💰 *ĐƠN HÀNG MỚI!*\n\n📦 Sản phẩm: ${order.products.title}\n💵 Số tiền: ${order.amount} USDT\n📧 Email: ${order.customer_email}\n🆔 Order ID: ${orderId}\n✅ Trạng thái: Đã thanh toán`;
          
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: message,
              parse_mode: 'Markdown'
            })
          });
        }
      }

      return new Response("OK", { status: 200 });
    } catch (err) {
      console.error(err);
      return new Response("Webhook Error", { status: 400 });
    }
  }

  return new Response("Not Found", { status: 404 });
});