import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useLang } from '../context/LangContext';
import { Zap, Wallet, ShieldCheck, ShoppingBag, Layers, ShoppingCart, CreditCard } from 'lucide-react'; // Thêm icon Layers
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';

export default function Home() {
  const { addToCart } = useCart();
  const { t, lang } = useLang();
  const navigate = useNavigate();

  // 1. Fetch Products kèm Variants
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['home-products'],
    queryFn: async () => {
      // Join bảng variants để lấy thông tin giá/ảnh của biến thể đầu tiên
      const { data, error } = await supabase
        .from('products')
        .select(`
            *,
            variants: product_variants(*)
        `)
        .order('id', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // 2. Fetch Stock từ View
  const { data: stocks = {} } = useQuery({
    queryKey: ['home-stocks'],
    queryFn: async () => {
      const { data } = await supabase.from('view_product_variant_stock').select('*');
      const map = {};
      data?.forEach(s => {
          const pid = s.product_id;
          if (!map[pid]) map[pid] = 0;
          map[pid] += (s.stock_available || 0);
      });
      return map;
    }
  });

  const handleAddToCart = (p) => {
      const currentStock = stocks[p.id] || 0;
      addToCart({ ...p, maxStock: currentStock });
      toast.success(t("Đã thêm vào giỏ hàng!", "Added to cart!"));
  };

  // Logic chuyển trang nếu có biến thể
  const handleOptionOrAdd = (p, hasVariants) => {
      if (hasVariants) {
          navigate(`/product/${p.id}`);
      } else {
          handleAddToCart(p);
      }
  };

  const handleBuyNow = (p, hasVariants) => {
      if (hasVariants) {
          navigate(`/product/${p.id}`);
      } else {
          const currentStock = stocks[p.id] || 0;
          addToCart({ ...p, maxStock: currentStock });
          navigate('/cart');
      }
  }

  if (isLoading) return <div className="h-64 flex justify-center items-center">Loading...</div>;

  return (
    <div className="space-y-12 pb-10">
      {/* HERO BANNER - KHÔI PHỤC GIAO DIỆN CŨ */}
      <section className="relative bg-gradient-to-r from-blue-900 to-indigo-900 text-white py-20 px-4 rounded-3xl shadow-xl overflow-hidden mt-6 mx-4">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1639322537228-f710d846310a?auto=format&fit=crop&q=80')] opacity-20 bg-cover bg-center mix-blend-overlay"></div>
        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
            {t('Giải pháp Tài khoản & Key', 'Premium Digital Keys & Accounts')}
            <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
              {t('Tự động - Uy tín - Giá rẻ', 'Automated - Trusted - Cheap')}
            </span>
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto">
            {t('Hệ thống cung cấp tài khoản Netflix, Spotify, VPN, Windows Key... tự động 24/7. Thanh toán tiện lợi qua Crypto.', 'Instant delivery system for Netflix, Spotify, VPN, Windows Keys... 24/7. Easy payment via Crypto.')}
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <Link to="/products" className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-full font-bold shadow-lg shadow-blue-500/30 transition transform hover:-translate-y-1 flex items-center gap-2">
              <ShoppingBag size={20}/> {t('Mua Ngay', 'Shop Now')}
            </Link>
            <a href="#features" className="px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full font-bold backdrop-blur-sm transition">
              {t('Tìm hiểu thêm', 'Learn More')}
            </a>
          </div>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section id="features" className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { icon: <Zap size={32} className="text-yellow-400"/>, title: t("Giao hàng Tự động", "Instant Delivery"), desc: t("Nhận hàng ngay lập tức sau khi thanh toán thành công.", "Get your items instantly after payment.") },
          { icon: <Wallet size={32} className="text-green-400"/>, title: t("Thanh toán Crypto", "Crypto Payment"), desc: t("Hỗ trợ USDT, BTC, ETH... qua cổng OxaPay an toàn.", "Support USDT, BTC, ETH... via secure OxaPay gateway.") },
          { icon: <ShieldCheck size={32} className="text-blue-400"/>, title: t("Bảo hành Uy tín", "Warranty Guaranteed"), desc: t("Hỗ trợ đổi mới 1-1 nếu sản phẩm lỗi trong thời gian bảo hành.", "1-1 replacement support if item is faulty during warranty.") }
        ].map((f, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition">
            <div className="mb-4 bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center">{f.icon}</div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">{f.title}</h3>
            <p className="text-slate-500">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* LATEST PRODUCTS */}
      <section className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-slate-800 mb-8 border-l-4 border-blue-600 pl-4">{t('Sản phẩm mới nhất', 'Latest Products')}</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((p) => {
            const stock = stocks[p.id] || 0;
            const isBuyable = stock > 0 || p.allow_external_key;

            // --- LOGIC XỬ LÝ BIẾN THỂ (GIÁ & ẢNH) ---
            const activeVariants = p.variants?.filter(v => v.is_active) || [];
            const hasVariants = activeVariants.length > 0;
            const firstVariant = hasVariants ? activeVariants[0] : null;

            // 1. Giá hiển thị: Nếu có biến thể -> Giá gốc + Mod của biến thể đầu tiên
            const displayPrice = hasVariants 
                ? p.price + (parseFloat(firstVariant.price_mod) || 0) 
                : p.price;

            // 2. Ảnh hiển thị: Ưu tiên ảnh SP -> Ảnh biến thể đầu tiên -> Placeholder
            const displayImage = (p.images && p.images.length > 0) 
                ? p.images[0] 
                : (firstVariant && firstVariant.image ? firstVariant.image : 'https://via.placeholder.com/300?text=No+Image');

            return (
            <div key={p.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl transition group flex flex-col h-full">
              <Link to={`/product/${p.id}`} className="relative block h-48 bg-slate-100 overflow-hidden">
                 <img src={displayImage} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                 <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                     {p.is_digital ? 
                        <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-100 font-bold">DIGITAL</span> :
                        <span className="text-[10px] bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-100 font-bold">PHYSICAL</span>
                     }
                  </div>
              </Link>
              
              <div className="p-4 flex flex-col flex-grow">
                <Link to={`/product/${p.id}`}>
                    <h3 className="font-bold text-slate-800 mb-1 line-clamp-2 hover:text-blue-600 transition min-h-[3rem]">
                        {lang === 'vi' ? p.title : (p.title_en || p.title)}
                    </h3>
                </Link>
                
                <div className="mt-auto pt-3">
                  <div className="flex flex-col mb-3">
                      <span className="text-xl font-extrabold text-green-600">{displayPrice.toFixed(2)} USDT</span>
                      {hasVariants && <span className="text-[10px] text-slate-400 italic">{t('Giá từ...', 'From...')}</span>}
                  </div>

                  <div className="flex gap-2">
                     {/* NÚT THÊM GIỎ: TỰ ĐỘNG CHUYỂN LOGIC */}
                     <button 
                        onClick={() => handleOptionOrAdd(p, hasVariants)} 
                        disabled={!isBuyable}
                        className={`flex-1 py-2 rounded-lg font-medium transition border text-sm disabled:opacity-50 flex items-center justify-center gap-1
                            ${hasVariants 
                                ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' 
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                     >
                        {hasVariants ? <><Layers size={14}/> {t('Tùy chọn', 'Option')}</> : <><ShoppingCart size={14}/> {t('Thêm', 'Add')}</>}
                     </button>

                     {/* NÚT MUA NGAY */}
                     <button 
                        onClick={() => handleBuyNow(p, hasVariants)} 
                        disabled={!isBuyable} 
                        className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition disabled:bg-gray-300 shadow-md text-sm flex items-center justify-center gap-1"
                     >
                        <CreditCard size={14}/> {t('Mua ngay', 'Buy Now')}
                     </button>
                  </div>
                </div>
              </div>
            </div>
            )
          })}
        </div>
      </section>
    </div>
  );
}
