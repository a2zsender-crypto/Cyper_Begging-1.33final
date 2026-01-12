import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useCart } from '../context/CartContext';
import { useLang } from '../context/LangContext';
import { Menu, X, ShoppingCart, User, LogOut, Globe, Shield } from 'lucide-react';

export default function Layout({ children }) {
  const { t, lang, switchLang } = useLang();
  const { cart } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // State lưu quyền (admin/mod/user)
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Kiểm tra session hiện tại
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id);
      }
    });

    // 2. Lắng nghe sự kiện đăng nhập/đăng xuất
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id);
      } else {
        setRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Hàm lấy role từ bảng profiles
  const fetchRole = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (data) {
        setRole(data.role);
      }
    } catch (err) {
      console.error("Error fetching role:", err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setUser(null);
    navigate('/login');
  };

  const navLinks = [
    { path: '/', label: t('Trang chủ', 'Home') },
    { path: '/products', label: t('Sản phẩm', 'Products') },
    { path: '/support', label: t('Hỗ trợ', 'Support') },
    { path: '/contact', label: t('Liên hệ', 'Contact') },
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-800 bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:scale-110 transition duration-300">
                C
              </div>
              <span className="font-extrabold text-xl bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight">
                CryptoShop
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-sm font-medium transition-colors hover:text-blue-600 ${
                    location.pathname === link.path ? 'text-blue-600' : 'text-slate-600'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="hidden md:flex items-center gap-4">
              {/* Language Switcher */}
              <button 
                onClick={switchLang}
                className="flex items-center gap-1 text-slate-500 hover:text-blue-600 transition"
                title="Switch Language"
              >
                <Globe size={18}/>
                <span className="text-xs font-bold uppercase">{lang}</span>
              </button>

              {/* Cart */}
              <Link to="/cart" className="relative p-2 text-slate-600 hover:text-blue-600 transition">
                <ShoppingCart size={22} />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                    {cart.reduce((total, item) => total + item.quantity, 0)}
                  </span>
                )}
              </Link>

              {/* Auth / User Menu */}
              {user ? (
                <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                  {/* Link Admin Panel: Hiển thị cho cả Admin và Mod */}
                  {(role === 'admin' || role === 'mod') && (
                    <Link 
                      to="/admin" 
                      className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full text-xs font-bold transition"
                    >
                      <Shield size={14}/>
                      <span>Panel</span>
                    </Link>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                      {user.email[0].toUpperCase()}
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="text-slate-400 hover:text-red-500 transition"
                      title={t("Đăng xuất", "Logout")}
                    >
                      <LogOut size={18}/>
                    </button>
                  </div>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="bg-slate-900 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-slate-800 transition shadow-lg shadow-slate-200"
                >
                  {t('Đăng nhập', 'Sign In')}
                </Link>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 text-slate-600"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 animate-slide-down">
            <div className="px-4 pt-2 pb-6 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`block py-3 px-4 rounded-lg font-medium ${
                    location.pathname === link.path
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              
              <div className="border-t border-slate-100 my-2 pt-2">
                 <button 
                    onClick={() => { switchLang(); setIsMenuOpen(false); }}
                    className="w-full text-left py-3 px-4 text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                 >
                    <Globe size={18}/> {t("Đổi ngôn ngữ", "Switch Language")} ({lang.toUpperCase()})
                 </button>

                 <Link
                    to="/cart"
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full text-left py-3 px-4 text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                 >
                    <ShoppingCart size={18}/> {t("Giỏ hàng", "Cart")} 
                    <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                        {cart.length}
                    </span>
                 </Link>
              </div>

              <div className="pt-2 border-t border-slate-100">
                {user ? (
                  <div className="space-y-2">
                    <div className="px-4 py-2 text-sm text-slate-500">
                      Signed in as <span className="font-bold text-slate-800">{user.email}</span>
                    </div>
                    
                    {/* Mobile Admin Link */}
                    {(role === 'admin' || role === 'mod') && (
                        <Link 
                            to="/admin"
                            onClick={() => setIsMenuOpen(false)}
                            className="block mx-4 bg-purple-100 text-purple-700 py-2 px-4 rounded-lg text-center font-bold text-sm"
                        >
                            Access Admin Panel
                        </Link>
                    )}

                    <button
                      onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                      className="w-full text-left py-3 px-4 text-red-500 hover:bg-red-50 font-medium flex items-center gap-2"
                    >
                      <LogOut size={18}/> {t("Đăng xuất", "Sign Out")}
                    </button>
                  </div>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="block w-full bg-slate-900 text-white text-center py-3 rounded-xl font-bold mt-4"
                  >
                    {t('Đăng nhập', 'Sign In')}
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center text-white font-bold text-xs">C</div>
                <span className="font-bold text-lg text-slate-800">CryptoShop</span>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed max-w-sm">
                {t(
                  "Hệ thống cung cấp sản phẩm số tự động uy tín hàng đầu. Thanh toán Crypto an toàn, bảo mật và nhận hàng ngay lập tức.",
                  "Leading automated digital product provider. Secure Crypto payment, privacy protection, and instant delivery."
                )}
              </p>
            </div>
            
            <div>
              <h3 className="font-bold text-slate-800 mb-4">{t("Liên kết", "Links")}</h3>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><Link to="/products" className="hover:text-blue-600 transition">{t("Sản phẩm", "Products")}</Link></li>
                <li><Link to="/support" className="hover:text-blue-600 transition">{t("Tra cứu đơn hàng", "Track Order")}</Link></li>
                <li><Link to="/contact" className="hover:text-blue-600 transition">{t("Liên hệ", "Contact")}</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-slate-800 mb-4">{t("Hỗ trợ", "Support")}</h3>
              <ul className="space-y-2 text-sm text-slate-500">
                <li>Telegram: <a href="#" className="text-blue-600 font-medium">@SupportBot</a></li>
                <li>Email: support@cryptoshop.com</li>
                <li>Working: 24/7</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-slate-100 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
            <p>&copy; {new Date().getFullYear()} CryptoShop. All rights reserved.</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-slate-600">Privacy Policy</a>
              <a href="#" className="hover:text-slate-600">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
