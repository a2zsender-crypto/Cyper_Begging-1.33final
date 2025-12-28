import { useEffect, useState } from 'react';
import { useLocation, Link, useNavigate, useSearchParams } from 'react-router-dom'; // Thêm useSearchParams
import { CheckCircle, Home, Copy, Send, ExternalLink, Loader } from 'lucide-react';
import { useLang } from '../context/LangContext';
import { supabase } from '../supabaseClient';

export default function Success() {
  const { t } = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // Để lấy tham số từ URL
  const [telegramUsername, setTelegramUsername] = useState('');
  const [orderDetails, setOrderDetails] = useState(null); // Lưu thông tin đơn hàng nếu fetch lại
  
  // 1. LẤY DỮ LIỆU TỪ NHIỀU NGUỒN (State hoặc URL)
  // Ưu tiên lấy từ State (khi vừa checkout xong)
  // Nếu mất State (F5 hoặc từ Oxapay về), lấy từ URL
  const orderId = location.state?.orderId || searchParams.get('orderId') || searchParams.get('trackId');
  const email = location.state?.email || searchParams.get('email');
  const total = location.state?.total || searchParams.get('total');
  const paymentLink = location.state?.paymentLink; // Link này thường chỉ có trong state

  // 2. LOGIC BẢO VỆ: Chỉ đá về Home nếu KHÔNG TÌM THẤY orderId ở đâu cả
  useEffect(() => {
    if (!orderId) {
      // Nếu không có mã đơn hàng thì mới về trang chủ
      // navigate('/'); 
      // TẠM THỜI COMMENT DÒNG TRÊN ĐỂ BẠN TEST GIAO DIỆN KHÔNG BỊ DIS,
      // KHI NÀO CHẠY THẬT THÌ BỎ COMMENT RA ĐỂ CHẶN NGƯỜI LẠ
    }
  }, [orderId, navigate]);

  // 3. Lấy thông tin cấu hình Telegram & Fetch lại đơn hàng nếu thiếu thông tin (Optional)
  useEffect(() => {
    const initData = async () => {
      // Lấy Telegram
      const { data: settingData } = await supabase.from('site_settings').select('value').eq('key', 'contact_telegram').single();
      if (settingData?.value) {
        setTelegramUsername(settingData.value.replace('@', ''));
      }

      // Nếu có ID mà thiếu thông tin (do F5 mất state), có thể fetch lại từ DB (Nâng cao)
      // Ở đây ta dùng thông tin hiển thị cơ bản để tránh phức tạp
    };
    initData();
  }, []);

  // Nếu không có orderId (và chưa bị redirect), hiển thị màn hình trống hoặc loading
  if (!orderId) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-400 gap-4">
              <p>No Order ID found.</p>
              <Link to="/" className="text-blue-600 hover:underline font-bold">Go Home</Link>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg text-center animate-fade-in-up border border-slate-100">
        
        {/* ICON THÀNH CÔNG */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="text-green-600 w-10 h-10" />
        </div>

        {/* TIÊU ĐỀ */}
        <h1 className="text-3xl font-extrabold text-slate-800 mb-2">
          {t('Đặt hàng thành công!', 'Order Placed Successfully!')}
        </h1>
        <p className="text-slate-500 mb-8">
          {t('Cảm ơn bạn đã mua hàng.', 'Thank you for your purchase.')}
        </p>

        {/* THÔNG TIN ĐƠN HÀNG */}
        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 mb-8 text-left space-y-3">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200">
            <span className="text-slate-500 text-sm font-medium">{t('Mã đơn hàng', 'Order ID')}</span>
            <span className="font-mono font-bold text-blue-600 text-lg">#{orderId}</span>
          </div>
          
          {email && (
            <div className="flex justify-between items-center">
                <span className="text-slate-500 text-sm font-medium">Email</span>
                <span className="font-medium text-slate-700">{email}</span>
            </div>
          )}

          {total && (
            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                <span className="text-slate-500 text-sm font-bold uppercase">{t('Tổng thanh toán', 'Total Amount')}</span>
                <span className="font-bold text-green-600 text-xl">{total} USDT</span>
            </div>
          )}
        </div>

        {/* HƯỚNG DẪN TIẾP THEO */}
        <div className="space-y-4 mb-8">
            {/* Nút mở lại link thanh toán (Chỉ hiện nếu có link và người dùng vừa đặt xong) */}
            {paymentLink && (
                <a 
                  href={paymentLink} 
                  target="_blank" 
                  rel="noreferrer"
                  className="block w-full py-3 bg-yellow-50 text-yellow-700 font-bold rounded-xl border border-yellow-200 hover:bg-yellow-100 transition flex items-center justify-center gap-2"
                >
                   {t('Mở lại link thanh toán (Nếu chưa đóng)', 'Re-open Payment Link (If not paid)')} <ExternalLink size={18}/>
                </a>
            )}

            <div className="text-sm text-slate-600 bg-blue-50 p-4 rounded-xl border border-blue-100 text-left">
                <p className="mb-2 flex gap-2">
                    ✅ <span>{t(
                        'Sau khi thanh toán xong, hệ thống sẽ tự động gửi sản phẩm về Email của bạn.', 
                        'After payment is completed, the system will automatically send the product to your Email.'
                    )}</span>
                </p>
                <p className="flex gap-2">
                    🛡️ <span>{t(
                        'Nếu cần hỗ trợ, hãy nhắn tin qua Telegram cho Shop kèm mã đơn hàng của bạn.', 
                        'If you need support, please message the Shop via Telegram with your order code.'
                    )}</span>
                </p>
            </div>

            {/* NÚT TELEGRAM */}
            {telegramUsername && (
                <a 
                    href={`https://t.me/${telegramUsername}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 bg-[#0088cc] hover:bg-[#007dbb] text-white font-bold rounded-xl transition shadow-lg shadow-blue-200"
                >
                    <Send size={20} />
                    {t('Chat hỗ trợ qua Telegram', 'Chat Support via Telegram')}
                </a>
            )}
        </div>

        {/* NÚT VỀ TRANG CHỦ */}
        <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 font-medium transition">
          <Home size={18} />
          {t('Quay về trang chủ', 'Back to Home')}
        </Link>

      </div>
    </div>
  );
}