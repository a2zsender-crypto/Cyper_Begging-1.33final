import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useLang } from '../context/LangContext';
import { ShoppingCart, User, Globe, LogOut, MapPin, Phone, Bitcoin, Mail, Menu, X, ChevronRight, Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useQuery } from '@tanstack/react-query';

export default function Layout() {
  const { cart } = useCart();
  const { lang, setLang, t } = useLang();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Realtime States
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotiDropdown, setShowNotiDropdown] = useState(false);
  const [session, setSession] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  const { data: settings = {} } = useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('site_settings').select('*').eq('is_public', true);
      const conf = {}; 
      data?.forEach(i => conf[i.key] = i.value);
      return conf;
    },
    staleTime: 1000 * 60 * 10
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); });
    return () => subscription.unsubscribe();
  }, []);

  // LOGIC CHUÔNG (User & Admin) - ĐÃ SỬA LOGIC ĐỒNG BỘ
  useEffect(() => {
      if (!session?.user) {
          setNotifications([]);
          setUnreadCount(0);
          return;
      }
      const uid = session.user.id;

      const fetchNoti = async () => {
          // 1. Lấy danh sách hiển thị (15 cái mới nhất)
          const { data } = await supabase.from('notifications')
              .select('*')
              .eq('user_id', uid)
              .order('created_at', {ascending: false})
              .limit(15);
          
          if (data) {
              setNotifications(data);
          }

          // 2. Lấy số lượng chưa đọc chính xác từ Database (Fix lỗi hiển thị sai số lượng)
          const { count } = await supabase.from('notifications')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', uid)
              .eq('is_read', false);
          
          setUnreadCount(count || 0);
      };
      
      fetchNoti();

      // Lắng nghe thông báo mới
      const channel = supabase.channel(`global-noti-${uid}`)
          .on('postgres_changes', 
              { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, 
              (payload) => {
                  setNotifications(prev => [payload.new, ...prev]);
                  setUnreadCount(prev => prev + 1);
                  toast.info(`🔔 ${payload.new.title}`);
              }
          )
          .subscribe();

      return () => { supabase.removeChannel(channel); };
  }, [session]);

  useEffect(() => setIsMenuOpen(false), [location]);

  // --- XỬ LÝ CLICK THÔNG BÁO (ĐÃ FIX DELAY & ĐỒNG BỘ) ---
  const handleReadNoti = async (noti) => {
      // Chỉ cập nhật nếu chưa đọc
      if (!noti.is_read) {
          // 1. Cập nhật UI ngay lập tức để trải nghiệm mượt mà
          setUnreadCount(prev => Math.max(0, prev - 1));
          setNotifications(prev => prev.map(n => n.id === noti.id ? { ...n, is_read: true } : n));

          // 2. Gửi lệnh update xuống DB (Cần SQL Policy ở Bước 1 để hoạt động)
          const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', noti.id);
          
          if (error) {
              console.error("Lỗi update notification:", error);
              // Nếu lỗi, revert lại UI (tuỳ chọn, nhưng giữ đơn giản thì thôi)
          }
      }
      
      setShowNotiDropdown(false);

      if (noti.link) {
          navigate(noti.link); 
          
          // NẾU LÀ TICKET: Chờ để trang AdminContacts kịp load
          if (noti.link.includes('ticketId=')) {
             try {
                 const ticketId = noti.link.split('ticketId=')[1];
                 setTimeout(() => {
                     window.dispatchEvent(new CustomEvent('FORCE_OPEN_TICKET', { detail: ticketId }));
                 }, 500); 
             } catch(e) { console.error(e); }
          }
      }
  };

  const handleLogout = async () => { 
      await supabase.auth.signOut(); 
      localStorage.clear(); 
      navigate('/login'); 
  };

  return (
    <div className="flex flex-col min-h-screen font-sans bg-slate-50 text-slate-800">
      <ToastContainer position="top-right" autoClose={3000} theme="light" />

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

            {/* BELL NOTIFICATION */}
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
      
      {/* FOOTER */}
      <footer className="bg-white border-t border-gray-200 pt-12 pb-8 mt-20">
        <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-12">
                <div className="md:col-span-4 flex flex-col items-start">
                    <div className="flex items-center gap-2 text-xl font-bold text-slate-800 mb-4">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white"><Bitcoin size={20}/></div>
                        {settings.site_name || 'CryptoShop'}
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed pr-4">
                        {lang === 'vi' 
                            ? (settings.footer_text || 'Uy tín, An toàn, Nhanh chóng. Hệ thống bán hàng tự động 24/7.') 
                            : (settings.footer_text_en || 'Trusted, Secure, Fast. Automated sales system 24/7.')}
                    </p>
                </div>
                <div className="md:col-span-3">
                    <h4 className="font-bold text-slate-800 mb-4 text-base">{t('Liên hệ', 'Contact')}</h4>
                    <ul className="space-y-3 text-sm text-slate-500">
                        <li className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 text-blue-500"/> {settings.contact_address || 'Vietnam'}</li>
                        <li className="flex items-center gap-2"><Phone size={16} className="text-blue-500"/> {settings.contact_phone || 'Hotline'}</li>
                        <li className="flex items-center gap-2"><Mail size={16} className="text-blue-500"/> {settings.contact_email || 'Email Support'}</li>
                    </ul>
                </div>
                <div className="md:col-span-2">
                    <h4 className="font-bold text-slate-800 mb-4 text-base">{t('Hỗ trợ', 'Support')}</h4>
                    <ul className="space-y-3 text-sm text-slate-500">
                        <li><Link to="/support#returns" className="hover:text-blue-600 transition">Policy & Privacy</Link></li>
                        <li><Link to="/support#terms" className="hover:text-blue-600 transition">Terms of Service</Link></li>
                        <li><Link to="/support#faq" className="hover:text-blue-600 transition">FAQ / Help Center</Link></li>
                    </ul>
                </div>
                <div className="md:col-span-3">
                    <h4 className="font-bold text-slate-800 mb-4 text-base">{t('Thanh toán', 'Payment')}</h4>
                    <p className="text-xs text-slate-400 mb-3">Secured by Oxapay (USDT, BTC, ETH)</p>
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <div className="border border-slate-200 rounded-xl px-3 py-1.5 bg-white shadow-sm hover:shadow-md transition cursor-pointer h-12 flex items-center justify-center">
                                <img src="/oxapay.png" alt="Oxapay" className="h-6 w-auto object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerText = 'Oxapay'; }}/>
                            </div>
                            <div className="flex items-center gap-2">
                                <img src="/usdt.png" alt="USDT" className="w-8 h-8 rounded-full shadow-sm bg-white border border-slate-100 hover:scale-110 transition" title="Tether" onError={(e)=>e.target.style.display='none'}/>
                                <img src="/btc.png" alt="BTC" className="w-8 h-8 rounded-full shadow-sm bg-white border border-slate-100 hover:scale-110 transition" title="Bitcoin" onError={(e)=>e.target.style.display='none'}/>
                                <img src="/eth.png" alt="ETH" className="w-8 h-8 rounded-full shadow-sm bg-white border border-slate-100 hover:scale-110 transition" title="Ethereum" onError={(e)=>e.target.style.display='none'}/>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="border-t border-gray-100 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-slate-400">
                <p>© 2025 {settings.site_name || 'CryptoShop'}. All rights reserved.</p>
                <div className="flex gap-4 mt-2 md:mt-0">
                    <Link to="/support#returns" className="hover:text-blue-500 cursor-pointer">Privacy</Link>
                    <Link to="/support#terms" className="hover:text-blue-500 cursor-pointer">Terms</Link>
                </div>
            </div>
        </div>
      </footer>
    </div>
  );
}
