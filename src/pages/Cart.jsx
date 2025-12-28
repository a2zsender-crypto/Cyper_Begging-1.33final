import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useLang } from '../context/LangContext';
import { supabase } from '../supabaseClient';
import { Trash2, CreditCard, MapPin, Send, Eye, EyeOff, CheckSquare, Square, UserCheck } from 'lucide-react';

export default function Cart() {
  const { cart, removeFromCart, updateQuantity } = useCart();
  const { t, lang } = useLang(); // Lấy biến lang (vi/en)
  
  // User State
  const [user, setUser] = useState(null);

  // Form State
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
      name: '', email: '', phone: '', address: '', 
      contactMethod: 'Telegram', contactInfo: ''
  });

  // State Đăng ký tài khoản
  const [isRegister, setIsRegister] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const hasPhysical = cart.some(p => !p.is_digital); 

  // 1. KIỂM TRA ĐĂNG NHẬP & TỰ ĐIỀN THÔNG TIN
  useEffect(() => {
      const checkUser = async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
              setUser(user);
              setFormData(prev => ({
                  ...prev,
                  email: user.email,
                  name: user.user_metadata?.full_name || prev.name
              }));
          }
      };
      checkUser();
  }, []);

  // Xử lý thanh toán
  const handleCheckout = async () => {
      if (!formData.name || !formData.email) return alert(t('Vui lòng điền Tên và Email', 'Please fill Name and Email'));
      if (hasPhysical && (!formData.phone || !formData.address)) return alert(t('Vui lòng điền địa chỉ giao hàng', 'Please fill shipping address'));
      
      // Validate Mật khẩu (Chỉ khi chưa đăng nhập và có tích chọn đăng ký)
      if (!user && isRegister && password.length < 6) {
          return alert(t('Mật khẩu phải từ 6 ký tự trở lên', 'Password must be at least 6 characters'));
      }

      setLoading(true);

      try {
          // 2. NẾU CHƯA ĐĂNG NHẬP VÀ CHỌN ĐĂNG KÝ -> TẠO TÀI KHOẢN
          if (!user && isRegister) {
              const { error: authError } = await supabase.auth.signUp({
                  email: formData.email,
                  password: password,
                  options: { data: { full_name: formData.name } }
              });

              if (authError) {
                  if (authError.message.includes('already registered')) {
                      alert(t('Email này đã có tài khoản. Thanh toán như khách.', 'Email exists. Guest checkout.'));
                  } else {
                      throw new Error(t('Lỗi đăng ký: ', 'Registration Error: ') + authError.message);
                  }
              }
          }

          // 3. GỌI EDGE FUNCTION (Đã thêm language)
          const { data, error } = await supabase.functions.invoke('payment-handler', {
              body: {
                  items: cart.map(i => ({ id: i.id, quantity: i.quantity })),
                  email: formData.email,
                  name: formData.name,
                  contactMethod: formData.contactMethod,
                  contactInfo: formData.contactInfo || (formData.contactMethod === 'Telegram' ? formData.contactInfo : formData.phone),
                  shippingAddress: formData.address,
                  phoneNumber: formData.phone,
                  
                  // QUAN TRỌNG: Gửi ngôn ngữ hiện tại sang Server để lấy tên SP đúng
                  language: lang 
              }
          });

          if (error) throw error;
          if (data?.error) throw new Error(data.error);

          if (data?.payUrl) {
              window.location.href = data.payUrl;
          }

      } catch (err) {
          alert("Error: " + err.message);
          setLoading(false);
      }
  };

  if (cart.length === 0) return (
      <div className="text-center py-20">
          <h2 className="text-2xl font-bold text-slate-700">{t('Giỏ hàng trống', 'Your cart is empty')}</h2>
          <p className="text-slate-500 mt-2">{t('Hãy quay lại cửa hàng để mua sắm.', 'Go back to shop and add some items.')}</p>
      </div>
  );

  return (
    <div className="max-w-6xl mx-auto py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* CỘT TRÁI: SẢN PHẨM */}
        <div className="lg:col-span-2 space-y-4">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">{t('Giỏ hàng của bạn', 'Your Cart')}</h2>
            {cart.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex gap-4 items-center">
                    <img src={item.images?.[0]} className="w-20 h-20 object-cover rounded-lg border"/>
                    <div className="flex-1">
                        <h3 className="font-bold text-slate-800 line-clamp-1">{lang === 'vi' ? item.title : (item.title_en || item.title)}</h3>
                        <p className="text-green-600 font-bold">{item.price} USDT</p>
                        
                        <div className="flex items-center gap-3 mt-2">
                            <button onClick={()=>updateQuantity(item.id, -1)} className="w-6 h-6 bg-slate-100 rounded text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold">-</button>
                            <span className="text-sm font-bold min-w-[20px] text-center">{item.quantity}</span>
                            <button onClick={()=>updateQuantity(item.id, 1)} className="w-6 h-6 bg-slate-100 rounded text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold">+</button>
                        </div>
                    </div>
                    <button onClick={()=>removeFromCart(item.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={20}/></button>
                </div>
            ))}
        </div>

        {/* CỘT PHẢI: FORM THANH TOÁN */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 h-fit sticky top-24">
            <h3 className="text-xl font-bold text-slate-800 mb-6 border-b pb-2">{t('Thông tin thanh toán', 'Billing Details')}</h3>
            
            {/* Nếu đã đăng nhập thì hiện thông báo nhỏ */}
            {user && (
                <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm mb-4 flex items-center gap-2">
                    <UserCheck size={16}/> {t('Đang đăng nhập:', 'Logged in as:')} <strong>{user.email}</strong>
                </div>
            )}

            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">{t('Họ tên', 'Full Name')}</label>
                    <input className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition" 
                        value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})}/>
                </div>

                <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-200">
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">{t('Email (Quan trọng)', 'Email (Important)')}</label>
                    <input type="email" className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition bg-white" 
                        placeholder="example@gmail.com"
                        value={formData.email} 
                        onChange={e=>setFormData({...formData, email: e.target.value})}
                        readOnly={!!user} // Nếu có user thì không cho sửa email để tránh lỗi logic
                    />
                    
                    {/* CHỈ HIỆN ĐĂNG KÝ NẾU CHƯA CÓ USER */}
                    {!user && (
                        <>
                            <div className="mt-3 flex items-start gap-2 cursor-pointer group" onClick={() => setIsRegister(!isRegister)}>
                                <div className={`mt-0.5 ${isRegister ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                                    {isRegister ? <CheckSquare size={18}/> : <Square size={18}/>}
                                </div>
                                <span className="text-sm text-slate-600 select-none group-hover:text-slate-800">
                                    {t('Tạo tài khoản để quản lý đơn hàng', 'Register an account to manage orders')}
                                </span>
                            </div>

                            {isRegister && (
                                <div className="mt-3 animate-fade-in-down">
                                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">{t('Mật khẩu đăng nhập', 'Create Password')}</label>
                                    <div className="relative">
                                        <input 
                                            type={showPassword ? "text" : "password"}
                                            className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition pr-10"
                                            placeholder="******"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                        />
                                        <button 
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setShowPassword(!showPassword); }}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    
                    <p className="text-[10px] text-red-500 mt-2 italic">* {t('Sản phẩm sẽ được gửi qua email này.', 'Products will be sent to this email.')}</p>
                </div>

                {hasPhysical && (
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 space-y-3">
                        <div className="flex items-center gap-2 text-orange-800 font-bold text-sm mb-1">
                            <MapPin size={16}/> {t('Thông tin giao hàng', 'Shipping Info (Required)')}
                        </div>
                        <input className="w-full border p-3 rounded-xl text-sm" placeholder={t('Số điện thoại', 'Phone Number')}
                            value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})}/>
                        <textarea className="w-full border p-3 rounded-xl text-sm h-20 resize-none" placeholder={t('Địa chỉ nhận hàng...', 'Shipping Address...')}
                            value={formData.address} onChange={e=>setFormData({...formData, address: e.target.value})}></textarea>
                    </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                        <label className="block text-xs font-bold text-slate-600 mb-1">Contact Via</label>
                        <select className="w-full border border-slate-200 p-3 rounded-xl bg-white" 
                            value={formData.contactMethod} onChange={e=>setFormData({...formData, contactMethod: e.target.value})}>
                            <option value="Telegram">Telegram</option>
                            <option value="Zalo">Zalo</option>
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-600 mb-1">ID / Username</label>
                        <input className="w-full border border-slate-200 p-3 rounded-xl" placeholder="@username..."
                            value={formData.contactInfo} onChange={e=>setFormData({...formData, contactInfo: e.target.value})}/>
                    </div>
                </div>
            </div>

            <div className="mt-8 pt-6 border-t">
                <div className="flex justify-between items-center mb-6">
                    <span className="text-xl font-bold text-slate-800">{t('Tổng cộng:', 'Total:')}</span>
                    <span className="text-2xl font-extrabold text-green-600">{total.toFixed(2)} USDT</span>
                </div>
                
                <button 
                    onClick={handleCheckout} 
                    disabled={loading}
                    className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition shadow-lg shadow-green-200 flex justify-center items-center gap-2"
                >
                    {loading ? (
                        <span className="animate-pulse">{t('Đang xử lý...', 'Processing...')}</span>
                    ) : (
                        <><CreditCard size={24}/> {t('THANH TOÁN NGAY', 'PAY NOW')}</>
                    )}
                </button>
                
                <p className="text-center text-xs text-slate-400 mt-4 flex items-center justify-center gap-1">
                    <Send size={12}/> {t('Hỗ trợ 24/7 qua Telegram', '24/7 Support via Telegram')}
                </p>
            </div>
        </div>
    </div>
  );
}
