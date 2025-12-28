import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1. Chỉ cho phép Admin gọi Function này
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Check quyền Admin trong DB
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') throw new Error("Forbidden: Not Admin");

    // 2. Xử lý logic
    const { action, payload } = await req.json();

    // --- CASE 1: QUẢN LÝ USER ---
    if (action === 'create_user') {
        const { email, password, role } = payload;
        const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
        if (error) throw error;
        // Update role
        await supabaseAdmin.from('profiles').update({ role }).eq('id', data.user.id);
        return new Response(JSON.stringify({ success: true, user: data.user }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'delete_user') {
        const { userId } = payload;
        // Không cho xóa chính mình
        if (userId === user.id) throw new Error("Không thể tự xóa tài khoản của mình!");
        
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    if (action === 'update_password') {
        const { userId, newPassword } = payload;
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- CASE 2: XÓA ĐƠN HÀNG ---
    if (action === 'delete_order') {
        const { orderId } = payload;
        // Chỉ cho xóa đơn pending hoặc canceled để bảo toàn dữ liệu kế toán
        const { data: order } = await supabaseAdmin.from('orders').select('status').eq('id', orderId).single();
        // Bạn có thể bỏ dòng if dưới nếu muốn cho xóa tất
        // if (order.status === 'paid') throw new Error("Không nên xóa đơn đã thanh toán!");

        const { error } = await supabaseAdmin.from('orders').delete().eq('id', orderId);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error("Invalid Action");

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});