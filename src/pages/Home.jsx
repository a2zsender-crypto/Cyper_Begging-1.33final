import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useCart } from '../context/CartContext';
import { useLang } from '../context/LangContext';
import { ShoppingCart, ArrowRight, Zap, Box, Layers } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';

export default function Home() {
  const { addToCart } = useCart();
  const { t, lang } = useLang();
  const navigate = useNavigate();

  // Fetch Products & Variants để lấy giá/ảnh của biến thể đầu tiên
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['home-products'],
    queryFn: async () => {
      // Join bảng variants để lấy biến thể đầu tiên của mỗi sp (nếu có)
      const { data, error } = await supabase
        .from('products')
        .select(`
            *,
            variants: product_variants(*)
        `)
        .eq('variants.is_active', true) // Chỉ lấy biến thể active
        .order('created_at', { ascending: false })
        .limit(8);
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch Stock (Giữ nguyên logic cũ của bạn)
  const { data: stocks = {} } = useQuery({
    queryKey: ['home-stock'],
    queryFn: async () => {
      const { data } = await supabase.from('view_product_variant_stock').select('*');
      const map = {};
      data?.forEach(row => {
          const pid = row.product_id;
          if (!map[pid]) map[pid] = 0;
          map[pid] += (row.stock_available || 0);
      });
      return map;
    }
  });

  const handleAddToCart = (p) => {
      const currentStock = stocks[p.id] || 0;
      // Nếu là sp đơn giản (ko biến thể) thì add
      addToCart({ ...p, maxStock: currentStock });
      toast.success(t("Đã thêm vào giỏ hàng!", "Added to cart!"));
  };

  if (isLoading) return <div className="h-64 flex justify-center items-center">Loading...</div>;

  return (
    <div className="pb-10">
      <section className="py-10 bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-3xl font-bold text-slate-800">{t('Sản phẩm mới', 'New Products')}</h2>
            <Link to="/products" className="text-blue-600 font-bold hover:underline flex items-center gap-1">
               {t('Xem tất cả', 'View All')} <ArrowRight size={18}/>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((p) => {
              const hasVariants = p.variants && p.variants.length > 0;
              const firstVariant = hasVariants ? p.variants[0] : null;
              
              // 1. LOGIC GIÁ: Nếu có biến thể -> Giá gốc + Mod của biến thể đầu tiên
              const displayPrice = hasVariants 
                  ? p.price + (parseFloat(firstVariant.price_mod) || 0) 
                  : p.price;

              // 2. LOGIC ẢNH: Ưu tiên ảnh SP -> Ảnh biến thể đầu tiên -> Placeholder
              const displayImage = (p.images && p.images.length > 0) 
                  ? p.images[0] 
                  : (firstVariant && firstVariant.image ? firstVariant.image : 'https://via.placeholder.com/300?text=No+Image');

              const stock = stocks[p.id] || 0;
              const isAvailable = stock > 0 || p.allow_external_key;

              return (
                <div key={p.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col group">
                  <Link to={`/product/${p.id}`} className="relative block h-48 bg-gray-100 overflow-hidden">
                    <img src={displayImage} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500"/>
                    
                    <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                        {p.is_digital ? 
                            <span className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded bg-purple-600 text-white shadow"><Zap size={10}/> DIGITAL</span> :
                            <span className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded bg-orange-500 text-white shadow"><Box size={10}/> PHYSIC</span>
                        }
                    </div>
                  </Link>

                  <div className="p-4 flex flex-col flex-grow">
                    <Link to={`/product/${p.id}`}>
                        <h3 className="font-bold text-slate-800 line-clamp-2 hover:text-blue-600 transition mb-1 min-h-[40px]">
                            {lang === 'vi' ? p.title : (p.title_en || p.title)}
                        </h3>
                    </Link>
                    
                    <div className="mt-auto pt-3 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-lg font-extrabold text-green-600">{displayPrice.toFixed(2)} $</span>
                            {hasVariants && <span className="text-[10px] text-slate-400 italic">{t('Giá từ...', 'From...')}</span>}
                        </div>

                        {/* 3. LOGIC NÚT BẤM: Có biến thể -> Tùy chọn. Không -> Thêm giỏ */}
                        {hasVariants ? (
                            <Link to={`/product/${p.id}`} className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1 transition">
                                <Layers size={14}/> {t('Tùy chọn', 'Option')}
                            </Link>
                        ) : (
                            <button 
                                onClick={() => handleAddToCart(p)} 
                                disabled={!isAvailable}
                                className="bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1 transition shadow-sm disabled:shadow-none"
                            >
                                <ShoppingCart size={14}/> {t('Thêm', 'Add')}
                            </button>
                        )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
