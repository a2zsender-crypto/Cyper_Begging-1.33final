import { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useLang } from '../context/LangContext';
import { ShoppingBag, Search, Zap, Box, Package, Layers, Loader } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';

export default function Products() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  
  const { addToCart } = useCart();
  const { t, lang } = useLang();
  const navigate = useNavigate();

  // 1. Lấy danh sách sản phẩm
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['public-products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('id', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // 2. [LOGIC MỚI] Lấy tồn kho từ View chi tiết và gom nhóm lại
  const { data: stocks = {} } = useQuery({
    queryKey: ['public-stock-variant'],
    queryFn: async () => {
      // Gọi View mới
      const { data, error } = await supabase.from('view_product_variant_stock').select('*');
      if (error) throw error;
      
      // Cộng dồn tồn kho của các biến thể vào Product ID cha
      const map = {};
      data?.forEach(row => {
          const pid = row.product_id;
          if (!map[pid]) map[pid] = 0;
          map[pid] += (row.stock_available || 0);
      });
      return map;
    }
  });

  const filteredProducts = useMemo(() => {
      return products.filter(p => {
          const matchesSearch = (p.title + (p.title_en || '')).toLowerCase().includes(search.toLowerCase());
          const matchesType = filterType === 'all' 
              ? true 
              : filterType === 'digital' ? p.is_digital : !p.is_digital;
          return matchesSearch && matchesType;
      });
  }, [products, search, filterType]);

  const handleAddToCart = (p) => {
      // Logic này chỉ áp dụng cho sản phẩm đơn giản (không biến thể)
      // Nếu có biến thể, nút Add sẽ chuyển thành "Option"
      const currentStock = stocks[p.id] || 0;
      addToCart({ ...p, maxStock: currentStock });
      toast.success(t("Đã thêm vào giỏ hàng!", "Added to cart successfully!"));
  };

  const handleBuyNow = (p) => {
      if (p.variants && p.variants.length > 0) {
          navigate(`/product/${p.id}`);
      } else {
          const currentStock = stocks[p.id] || 0;
          addToCart({ ...p, maxStock: currentStock });
          navigate('/cart');
      }
  }

  if (loadingProducts) return (
      <div className="flex justify-center items-center h-screen text-blue-600">
          <Loader className="animate-spin w-10 h-10"/>
      </div>
  );

  return (
    <div className="pb-10">
      {/* HERO BANNER & TOOLBAR GIỮ NGUYÊN NHƯ CŨ (Đã rút gọn code hiển thị) */}
      <section className="py-14 mb-10 bg-gradient-to-b from-blue-50 to-white rounded-3xl border border-blue-50/50">
        <div className="text-center max-w-2xl mx-auto px-4">
            <h1 className="text-4xl font-extrabold text-slate-800 mb-4">{t('Khám phá', 'Explore')} <span className="text-blue-600">CryptoShop</span></h1>
        </div>
      </section>

      {/* FILTER BAR GIỮ NGUYÊN */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm sticky top-20 z-30">
          <input className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200" placeholder={t('Tìm tên sản phẩm...', 'Search products...')} value={search} onChange={e => setSearch(e.target.value)} />
          <select className="px-4 py-2.5 rounded-xl border border-slate-200" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">All</option>
              <option value="digital">Digital</option>
              <option value="physical">Physical</option>
          </select>
      </div>

      {/* GRID SẢN PHẨM */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredProducts.map((p) => {
            const stock = stocks[p.id] || 0;
            const hasVariants = p.variants && Array.isArray(p.variants) && p.variants.length > 0;
            // Cho phép mua nếu có stock hoặc cấu hình cho phép lấy key ngoài
            const isAvailable = stock > 0 || p.allow_external_key;

            return (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-xl transition duration-300 border border-slate-100 flex flex-col group">
                <Link to={`/product/${p.id}`} className="relative block h-52 overflow-hidden bg-gray-100">
                    {p.images && p.images[0] ? (
                        <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover transform group-hover:scale-105 transition duration-500" />
                    ) : <div className="flex items-center justify-center h-full text-gray-400">No Image</div>}
                    
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
                        <h3 className="font-bold text-base mb-2 text-slate-800 hover:text-blue-600 transition line-clamp-2 min-h-[3rem]">
                            {lang === 'vi' ? p.title : (p.title_en || p.title)}
                        </h3>
                    </Link>
                    
                    <div className="mt-auto pt-2">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-green-600 font-extrabold text-xl">{p.price} USDT</span>
                            {hasVariants && <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500 font-medium">Options</span>}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {hasVariants ? (
                                <Link to={`/product/${p.id}`} className="bg-slate-50 text-slate-700 py-2.5 rounded-xl font-bold hover:bg-slate-100 transition border border-slate-200 text-xs flex items-center justify-center">
                                    {t('Tùy chọn', 'Options')}
                                </Link>
                            ) : (
                                <button onClick={() => handleAddToCart(p)} disabled={!isAvailable} className="bg-slate-50 text-slate-700 py-2.5 rounded-xl font-bold hover:bg-slate-100 transition border border-slate-200 text-xs disabled:opacity-50">
                                    {t('Thêm giỏ', 'Add Cart')}
                                </button>
                            )}
                            <button onClick={() => handleBuyNow(p)} disabled={!isAvailable} className="bg-blue-600 text-white py-2.5 rounded-xl font-bold hover:bg-blue-700 transition disabled:bg-gray-300 shadow-md text-xs">
                                {t('Mua ngay', 'Buy Now')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            )
        })}
      </div>
    </div>
  );
}