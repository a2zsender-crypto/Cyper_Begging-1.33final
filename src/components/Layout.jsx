import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useLang } from '../context/LangContext';
import { ShoppingCart, User, Globe, LogOut, MapPin, Phone, Send, Bitcoin, Mail, Menu, X, ChevronRight, Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

// --- THÊM MỚI: Thư viện Toast ---
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
// --------------------------------

export default function Layout() {
  const { cart } = useCart();
  const { lang, setLang, t } = useLang();
  const [settings, setSettings] = useState({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotiDropdown, setShowNotiDropdown] = useState(false);
  const [session, setSession] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    supabase.from('site_settings').select('*').eq('is_public', true)
      .then(({ data }) => {
        const conf = {}; data?.forEach(i => conf[i.key] = i.value);
        setSettings(conf);
      });

    supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- LOGIC REALTIME CHUÔNG ---
  useEffect(() => {
      if (!session?.user) {
          setNotifications([]);
          return;
      }

      const uid = session.user.id;

      // 1. Lấy thông báo cũ
      const fetchNoti = async () => {
          const { data } = await supabase.from('notifications')
              .select('*')
              .eq('user_id', uid)
              .order('created_at', {ascending: false})
              .limit(10);
          if (data) {
              setNotifications(data);
              setUnreadCount(data.filter(n => !n.is_read).length);
          }
      };
      fetchNoti();

      // 2. Realtime
      const channel = supabase.channel('global-notifications')
          .on('postgres_changes', 
              { event: 'INSERT', schema: 'public', table: 'notifications' }, 
              (payload) => {
                  if (payload.new.user_id === uid) {
                      setNotifications(prev => [payload.new, ...prev]);
                      setUnreadCount(prev => prev + 1);
                      // Hiển thị popup nhỏ góc màn hình khi có thông báo mới
                      toast.info(`🔔 ${payload.new.title}: ${payload.new.message}`);
                  }
              }
          )
          .subscribe();

      return () => { supabase.removeChannel(channel); };
  }, [session]);

  useEffect(() => setIsMenuOpen(false), [location]);

  const handleReadNoti = async (noti) => {
      if (!noti.is_read) {
          await supabase.from('notifications').update({ is_read: true }).eq('id', noti.id);
          setUnreadCount(prev => Math.max(0, prev - 1));
          setNotifications(prev => prev.map(n => n.id === noti.id ? { ...n, is_read: true } : n));
      }
      setShowNotiDropdown(false);
      if (noti.link) navigate(noti.link);
  };

  const handleLogout = async () => { 
      await supabase.auth.signOut(); 
      localStorage.clear(); 
      toast.success(t("Đăng xuất thành công!", "Logged out successfully!"));
      navigate('/login'); 
  };

  return (
    <div className="flex flex-col min-h-screen font-sans bg-slate-50 text-slate-800">
      
      {/* --- CẤU HÌNH TOAST CONTAINER (Để hiển thị thông báo toàn ứng dụng) --- */}
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={true} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="light" />

      {/* HEADER */}
      <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-gray-100">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          
          <div className="flex items-center gap-4">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-slate-600 hover:text-blue-600 focus:outline-none">
                  {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
              </button>

              <Link to="/" className="flex items-center gap-2 group">
                {settings.site_logo_url ? (
                  <img src={settings.site_logo_url} alt="Logo" className="h-10 object-contain" />
                ) : (
                    <div className="flex items-center gap-2 text-xl font-bold text-slate-800">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white"><Bitcoin size={20}/></div>
                        CryptoShop
                    </div>
                )}
              </Link>
          </div>

          <div className="hidden md:flex items-center gap-8 font-medium text-sm text-slate-600">
            <Link to="/" className="hover:text-blue-600 transition">{t('Trang chủ', 'Home')}</Link>
            <Link to="/products" className="hover:text-blue-600 transition">{t('Sản phẩm', 'Products')}</Link>
            <Link to="/support" className="hover:text-blue-600 transition">{t('Hỗ trợ', 'Support')}</Link>
            <Link to="/contact" className="hover:text-blue-600 transition">{t('Liên hệ', 'Contact')}</Link>
          </div>

          <div className="flex items-center gap-3 md:gap-5 text-slate-600">
            <button onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')} className="flex items-center gap-1 hover:text-blue-600 text-sm font-bold bg-slate-100 px-3 py-1.5 rounded-full transition">
              <Globe size={16} /> {lang.toUpperCase()}
            </button>

            {/* CHUÔNG THÔNG BÁO */}
            {session && (
                <div className="relative">
                    <button onClick={() => setShowNotiDropdown(!showNotiDropdown)} className="relative hover:text-blue-600 transition p-1">
                        <Bell size={22} className={unreadCount > 0 ? 'text-blue-600 animate-pulse' : ''} />
                        {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow-sm ring-2 ring-white">{unreadCount}</span>}
                    </button>
                    {showNotiDropdown && (
                        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-fade-in-up origin-top-right">
                            <div className="p-3 border-b bg-gray-50 font-bold text-sm text-gray-700 flex justify-between items-center">
                                <span>{t('Thông báo', 'Notifications')}</span>
                                <button onClick={()=>setShowNotiDropdown(false)}><X size={16}/></button>
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                                {notifications.length > 0 ? notifications.map(n => (
                                    <div key={n.id} onClick={() => handleReadNoti(n)} className={`p-3 border-b hover:bg-blue-50 cursor-pointer transition flex gap-3 ${!n.is_read ? 'bg-blue-50/40' : ''}`}>
                                        <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${!n.is_read ? 'bg-blue-500' : 'bg-transparent'}`}></div>
                                        <div>
                                            <p className={`text-sm ${!n.is_read ? 'font-bold text-slate-800' : 'text-slate-600'}`}>{n.title}</p>
                                            <p className="text-xs text-slate-500 line-clamp-2">{n.message}</p>
                                            <p className="text-[10px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="p-8 text-center text-slate-400 text-sm">{t('Không có thông báo', 'No notifications')}</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <Link to="/cart" className="relative hover:text-blue-600">
              <ShoppingCart size={22} />
              {cart.length > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">{cart.length}</span>}
            </Link>

            <div className="group relative hidden md:block">
                <Link to="/admin" className="hover:text-blue-600 block py-2"><User size={22} /></Link>
                <div className="absolute right-0 top-full pt-2 w-56 hidden group-hover:block z-50">
                    <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
                        <Link to="/admin" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-sm font-medium text-slate-700 transition">
                            <User size={16}/> {t('Tài khoản', 'My Account')}
                        </Link>
                        <div className="border-t border-gray-100"></div>
                        <button onClick={handleLogout} className="flex w-full items-center gap-3 px-4 py-3 hover:bg-red-50 text-sm font-medium text-red-600 transition text-left">
                            <LogOut size={16}/> {t('Đăng xuất', 'Logout')}
                        </button>
                    </div>
                </div>
            </div>
          </div>
        </div>

        {isMenuOpen && (
            <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-gray-200 shadow-xl animate-fade-in z-40">
                <div className="flex flex-col p-4 space-y-4 font-medium text-slate-600">
                    <Link to="/" className="flex justify-between items-center py-2 border-b border-slate-50 hover:text-blue-600">{t('Trang chủ', 'Home')} <ChevronRight size={16}/></Link>
                    <Link to="/products" className="flex justify-between items-center py-2 border-b border-slate-50 hover:text-blue-600">{t('Sản phẩm', 'Products')} <ChevronRight size={16}/></Link>
                    <Link to="/support" className="flex justify-between items-center py-2 border-b border-slate-50 hover:text-blue-600">{t('Hỗ trợ', 'Support')} <ChevronRight size={16}/></Link>
                    <Link to="/contact" className="flex justify-between items-center py-2 border-b border-slate-50 hover:text-blue-600">{t('Liên hệ', 'Contact')} <ChevronRight size={16}/></Link>
                    <Link to="/admin" className="flex justify-between items-center py-2 hover:text-blue-600">{t('Tài khoản', 'Account')} <User size={16}/></Link>
                </div>
            </div>
        )}
      </nav>

      <main className="flex-grow container mx-auto px-4"><Outlet /></main>
      
      <footer className="bg-white border-t border-gray-200 pt-16 pb-8 mt-20">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div><div className="flex items-center gap-2 text-xl font-bold text-slate-800 mb-4"><div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white"><Bitcoin size={20}/></div>CryptoShop</div><p className="text-sm text-slate-500 mb-6">{t('Uy tín, An toàn, Nhanh chóng.', 'Trusted, Secure, Fast.')}</p></div>
            <div><h4 className="font-bold text-slate-800 mb-6">{t('Liên hệ', 'Contact')}</h4><ul className="space-y-4 text-sm text-slate-500"><li>{settings.contact_address}</li><li>Hotline: {settings.contact_phone}</li><li>Email: {settings.contact_email}</li></ul></div>
            <div><h4 className="font-bold text-slate-800 mb-6">{t('Hỗ trợ', 'Support')}</h4><ul className="space-y-3 text-sm text-slate-500"><li><Link to="/support">Policy</Link></li><li><Link to="/support">FAQ</Link></li></ul></div>
            <div><h4 className="font-bold text-slate-800 mb-6">{t('Thanh toán', 'Payment')}</h4><p className="text-sm text-slate-500">Via Oxapay (USDT, BTC, ETH)</p></div>
        </div>
        <div className="border-t border-gray-100 pt-8 text-center text-sm text-slate-400">© 2025 CryptoShop.</div>
      </footer>
    </div>
  );
}