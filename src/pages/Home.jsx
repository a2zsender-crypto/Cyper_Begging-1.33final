import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useCart } from '../context/CartContext';
import { useLang } from '../context/LangContext';
import { ShoppingBag, Star, ArrowRight, Zap, Box } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom'; // Import useNavigate
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';

export default function Home() {
  const { addToCart } = useCart();
  const { t, lang } = useLang();
  const navigate = useNavigate(); // Hook chuyển trang

  // 1. Lấy sản phẩm (Ưu tiên sản phẩm mới nhất)
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['home-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8); // Lấy 8 sp mới nhất
      if (error) throw error;
      return data;
    }
  });

  // 2. Lấy tồn kho (Để hiển thị đúng trạng thái)
  const { data: stocks = {} } = useQuery({
    queryKey: ['home-stock'],
    queryFn: async () => {
      const { data, error } = await supabase.from('view_product_variant_stock').select('*');
      if (error) throw error;
      
      const map = {};
      data?.forEach(row => {
          const pid = row.product_id;
          if (!map[pid]) map[pid] = 0;
          map[pid] += (row.stock_available || 0);
      });
      return map;
    }
  });

  // Xử lý thêm vào giỏ (Chỉ dùng cho sp không biến thể)
  const handleAddToCart = (p) => {
      const currentStock = stocks[p.id] || 0;
      addToCart({ ...p, maxStock: currentStock });
      toast.success(t("Đã thêm vào giỏ hàng!", "Added to cart successfully!"));
  };

  // Xử lý chuyển trang (Cho sp có biến thể)
  const handleOptions = (id) => {
      navigate(`/product/${id}`);
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center text-blue-600">Loading...</div>;

  return (
    <div className="space-y-16 pb-10">
      {/* HERO SECTION */}
      <section className="relative bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl overflow-hidden shadow-2xl mx-4 mt-4">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1920&q=80')] opacity-10 bg-cover bg-center mix-blend-overlay"></div>
        <div className="relative px-8 py-20 md:py-32 text-center text-white max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight leading-tight">
            {t('Thế giới Tài khoản & Key', 'Digital Keys & Accounts')}
            <br />
            <span className="text-blue-200">{t('Uy tín hàng đầu', 'Premium Quality')}</span>
          </h1>
          <p className="text-lg md:text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            {t('Hệ thống bán hàng tự động 24/7. Thanh toán an toàn, nhận hàng ngay lập tức.', 'Automated 24/7 delivery system. Secure payment, instant delivery.')}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/products" className="px-8 py-4 bg-white text-blue-700 rounded-full font-bold hover:bg-blue-50 transition shadow-lg flex items-center justify-center gap-2">
              <ShoppingBag size={20} />
              {t('Mua ngay', 'Shop Now')}
            </Link>
            <Link to="/support" className="px-8 py-4 bg-blue-800/30 backdrop-blur-sm border border-white/20 text-white rounded-full font-bold hover:bg-blue-800/50 transition flex items-center justify-center gap-2">
              <Star size={20} />
              {t('Hỗ trợ', 'Support')}
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="container mx-auto px-4">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">{t('Sản phẩm mới', 'New Arrivals')}</h2>
            <p className="text-slate-500 mt-1">{t('Cập nhật liên tục các sản phẩm hot nhất', 'Latest updates on hot items')}</p>
          </div>
          <Link to="/products" className="hidden md:flex items-center gap-2 text-blue-600 font-bold hover:text-blue-700 transition">
            {t('Xem tất cả', 'View All')} <ArrowRight size={20} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((p) => {
            const stock = stocks[p.id] || 0;
            // [FIX] Kiểm tra biến thể
            const hasVariants = p.variants && Array.isArray(p.variants) && p.variants.length > 0;
            // Cho phép mua nếu có stock hoặc cấu hình cho phép lấy key ngoài
            const isAvailable = stock > 0 || p.allow_external_key;

            return (
              <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl transition group flex flex-col">
                <Link to={`/product/${p.id}`} className="block relative h-48 overflow-hidden bg-gray-50">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover transform group-hover:scale-105 transition duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">No Image</div>
                  )}
                  <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg text-white shadow-sm ${isAvailable ? 'bg-green-500' : 'bg-red-500'}`}>
                          {isAvailable ? `${t('Sẵn hàng', 'In Stock')}: ${stock}` : t('Hết hàng', 'Out of Stock')}
                      </span>
                      {p.is_digital ? 
                          <span className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-purple-600 text-white shadow-sm"><Zap size={10}/> DIGITAL</span> :
                          <span className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-orange-500 text-white shadow-sm"><Box size={10}/> PHYSIC</span>
                      }
                  </div>
                </Link>
                
                <div className="p-5 flex flex-col flex-grow">
                  <Link to={`/product/${p.id}`}>
                    <h3 className="font-bold text-slate-800 mb-1 line-clamp-2 hover:text-blue-600 transition min-h-[3rem]">
                      {lang === 'vi' ? p.title : (p.title_en || p.title)}
                    </h3>
                  </Link>
                  
                  <div className="mt-auto pt-3 flex items-center justify-between">
                    <span className="text-xl font-extrabold text-green-600">{p.price} USDT</span>
                    
                    {/* [FIX LOGIC BUTTON] */}
                    {hasVariants ? (
                        <button 
                            onClick={() => handleOptions(p.id)} 
                            className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2 rounded-lg font-bold text-sm transition"
                        >
                            {t('Tùy chọn', 'Options')}
                        </button>
                    ) : (
                        <button 
                            onClick={() => handleAddToCart(p)} 
                            disabled={!isAvailable}
                            className="bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 px-4 py-2 rounded-lg font-bold text-sm transition shadow-md disabled:shadow-none"
                        >
                            {t('Thêm giỏ', 'Add')}
                        </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-8 text-center md:hidden">
           <Link to="/products" className="inline-flex items-center gap-2 text-blue-600 font-bold hover:text-blue-700 transition">
            {t('Xem tất cả sản phẩm', 'View All Products')} <ArrowRight size={20} />
          </Link>
        </div>
      </section>
    </div>
  );
}
