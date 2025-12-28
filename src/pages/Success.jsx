import { useEffect, useState } from 'react';
import { useLocation, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Home, Send, ExternalLink, Package } from 'lucide-react';
import { useLang } from '../context/LangContext';
import { supabase } from '../supabaseClient';

export default function Success() {
  const { t } = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [telegramUsername, setTelegramUsername] = useState('');
  const [orderDetails, setOrderDetails] = useState(null);
  
  // Lấy orderId từ URL (Ưu tiên) hoặc State
  const orderId = searchParams.get('orderId') || location.state?.orderId;

  // 1. Fetch thông tin đơn hàng từ DB nếu có orderId
  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(products(title, is_digital))')
        .eq('id', orderId)
        .single();
      
      if (!error && data) {
        setOrderDetails(data);
      }
    };
    fetchOrder();
  }, [orderId]);

  // 2. Lấy thông tin cấu hình Telegram
  useEffect(() => {
    const initData = async () => {
      const { data: settingData } = await supabase.from('site_settings').select('value').eq('key', 'contact_telegram').single();
      if (settingData?.value) {
        setTelegramUsername(settingData.value.replace('@', ''));
      }
    };
    initData();
  }, []);

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
        {orderDetails && (
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 mb-8 text-left space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <span className="text-slate-500 text-sm font-medium">{t('Mã đơn hàng', 'Order ID')}</span>
                <span className="font-mono font-bold text-blue-600 text-lg">#{orderDetails.id}</span>
              </div>
              
              <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-sm font-medium">Email</span>
                  <span className="font-medium text-slate-700">{orderDetails.customer_email}</span>
              </div>

              <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-sm font-medium">Status</span>
                  <span className={`font-bold uppercase text-xs px-2 py-1 rounded ${orderDetails.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {orderDetails.status}
                  </span>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                  <span className="text-slate-500 text-sm font-bold uppercase">{t('Tổng thanh toán', 'Total Amount')}</span>
                  <span className="font-bold text-green-600 text-xl">{orderDetails.amount} USDT</span>
              </div>
            </div>
        )}

        {/* HƯỚNG DẪN TIẾP THEO */}
        <div className="space-y-4 mb-8">
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
