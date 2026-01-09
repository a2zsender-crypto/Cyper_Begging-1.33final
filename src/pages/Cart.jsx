import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useLang } from '../context/LangContext';
import { supabase } from '../supabaseClient';
import { Trash2, CreditCard, MapPin, Send, Eye, EyeOff, CheckSquare, Square, UserCheck, ShoppingBag, ArrowLeft, Minus, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Cart() {
  const { cart, removeFromCart, updateQuantity, clearCart } = useCart();
  const { t, lang } = useLang(); 
  
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

  // Tính tổng tiền client
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const hasPhysical = cart.some(p => !p.is_digital); 

  // 1. KIỂM TRA ĐĂNG NHẬP
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
      
      if (!user && isRegister && password.length < 6) {
          return alert(t('Mật khẩu phải từ 6 ký tự trở lên', 'Password must be at least 6 characters'));
      }

      setLoading(true);

      try {
          // Xử lý đăng ký nếu có
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

          // --- LOGIC CHUẨN BỊ DỮ LIỆU GỬI BACKEND ---
          const itemsPayload = cart.map(i => {
              // 1. Lấy tên gốc
              let itemName = lang === 'vi' ? i.title : (i.title_en || i.title);
              
              // 2. Xử lý chuỗi biến thể chi tiết
              let variantDetails = '';

              if (i.selectedVariants && typeof i.selectedVariants === 'object') {
                  // Object: {Color: "Red", Storage: "256GB"} -> "Color: Red, Storage: 256GB"
                  variantDetails = Object.entries(i.selectedVariants)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(', ');
              } else if (i.variant_name) {
                  variantDetails = i.variant_name;
              } else if (typeof i.selected_variant === 'string') {
                  variantDetails = i.selected_variant;
              }

              // 3. Ghép tên hiển thị (cho đẹp mắt nếu cần debug)
              const fullName = variantDetails ? `${itemName} (${variantDetails})` : itemName;

              return {
                  id: i.id,
                  quantity: i.quantity,
                  price: i.price,
                  name: fullName,
                  is_digital: i.is_digital,
                  variant: variantDetails, // <--- QUAN TRỌNG: Gửi riêng biến thể để Backend lưu vào cột variant_name
                  selected_variants: i.selectedVariants // Gửi raw data dự phòng
              };
          });

          // Gọi Edge Function
          const { data, error } = await supabase.functions.invoke('payment-handler', {
              body: {
                  cart: itemsPayload, // <--- ĐÃ SỬA: Đổi key 'items' thành 'cart' để khớp Backend
                  email: formData.email,
                  name: formData.name,
                  contactMethod: formData.contactMethod,
                  contactInfo: formData.contactInfo || (formData.contactMethod === 'Telegram' ? formData.contactInfo : formData.phone),
                  shippingAddress: formData.address,
                  phoneNumber: formData.phone,
                  language: lang // Gửi ngôn ngữ (vi/en)
              }
          });

          if (error) { console.error("Function Error:", error); throw error; }
          if (data?.error) throw new Error(data.error);

          if (data?.payLink) { // Backend trả về payLink (chứ không phải payUrl, kiểm tra lại backend trả gì thì dùng đó, thường OxaPay là payLink)
              clearCart(); 
              window.location.href = data.payLink;
          } else if (data?.payUrl) {
              clearCart();
              window.location.href = data.payUrl;
          } else {
            throw new Error("Không nhận được link thanh toán từ hệ thống.");
          }

      } catch (err) {
          console.error("Checkout Error Full:", err);
          alert("Error: " + (err.message || "Unknown error"));
          setLoading(false);
      }
  };

  if (cart.length === 0) return (
      <div className="container mx-auto px-4 py-16 text-center">
          <div className="flex justify-center mb-6">
            <ShoppingBag size={64} className="text-gray-300" />
          </div>
          <h2 className="text-2xl font-bold mb-4">{t('Giỏ hàng trống', 'Your cart is empty')}</h2>
          <p className="text-gray-600 mb-8">{t('Hãy quay lại cửa hàng để mua sắm.', 'Go back to shop and add some items.')}</p>
          <Link to="/products" className="inline-flex items-center bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
            <ArrowLeft size={20} className="mr-2" />
            {t('Tiếp tục mua sắm', 'Continue Shopping')}
          </Link>
      </div>
  );

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">{t('Giỏ hàng của bạn', 'Your Cart')}</h2>
            {cart.map(item => {
                // Logic hiển thị tên biến thể ở UI
                let variantDisplay = '';
                if (item.selectedVariants && typeof item.selectedVariants === 'object') {
                     variantDisplay = Object.entries(item.selectedVariants)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(', ');
                } else {
                     variantDisplay = item.variant_name || item.selected_variant || '';
                }

                return (
                <div key={item.cartItemId || item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4 items-center">
                    <img src={item.images?.[0] || item.image} className="w-20 h-20 object-cover rounded-lg border" alt={item.title}/>
                    <div className="flex-1 text-center sm:text-left">
                        <h3 className="font-bold text-slate-800 line-clamp-1">
                             {lang === 'vi' ? item.title : (item.title_en || item.title)}
                             {variantDisplay && 
                                <span className="text-sm font-normal text-gray-500 block sm:inline sm:ml-2">
                                    ({variantDisplay})
                                </span>
                             }
                        </h3>
                        <p className="text-green-600 font-bold">{item.price} USDT</p>
                        
                        <div className="flex items-center justify-center sm:justify-start gap-3 mt-2">
                            <button onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)} className="w-8 h-8 bg-slate-100 rounded text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold">
                                <Minus size={16} />
                            </button>
                            <span className="text-sm font-bold min-w-[20px] text-center">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)} className="w-8 h-8 bg-slate-100 rounded text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold">
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>
                    <button onClick={() => removeFromCart(item.cartItemId)} className="text-red-400 hover:text-red-600 p-2">
                        <Trash2 size={20}/>
                    </button>
                </div>
                );
            })}
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 h-fit sticky top-24">
            <h3 className="text-xl font-bold text-slate-800 mb-6 border-b pb-2">{t('Thông tin thanh toán', 'Billing Details')}</h3>
            
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
                        readOnly={!!user}
                    />
                    
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
                    className={`w-full py-4 rounded-xl font-bold text-lg text-white transition shadow-lg flex justify-center items-center gap-2
                        ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 shadow-green-200'}`}
                >
                    {loading ? <span className="animate-pulse">{t('Đang xử lý...', 'Processing...')}</span> : <><CreditCard size={24}/> {t('THANH TOÁN NGAY', 'PAY NOW')}</>}
                </button>
                <p className="text-center text-xs text-slate-400 mt-4 flex items-center justify-center gap-1"><Send size={12}/> {t('Hỗ trợ 24/7 qua Telegram', '24/7 Support via Telegram')}</p>
            </div>
        </div>
    </div>
  );
}
