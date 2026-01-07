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

  // 1. Dùng React Query để lấy Sản phẩm
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['public-products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('id', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // 2. Dùng React Query để lấy Tồn kho (Giữ lại để tương thích ngược nếu cần)
  const { data: stocks = {} } = useQuery({
    queryKey: ['public-stock'],
    queryFn: async () => {
      const { data, error } = await supabase.from('product_stock').select('*');
      if (error) throw error;
      const map = {};
      data?.forEach(s => map[s.product_id] = s.stock_count);
      return map;
    }
  });

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.title.toLowerCase().includes(search.toLowerCase());
      const matchType = filterType === 'all' 
        ? true 
        : filterType === 'digital' ? p.is_digital 
        : !p.is_digital;
      return matchSearch && matchType;
    });
  }, [products, search, filterType]);

  const handleAddToCart = (product) => {
    // Truyền đúng stockCount vào để CartContext xử lý
    const stock = calculateRealStock(product);
    addToCart({ ...product, maxStock: stock });
  };

  const handleBuyNow = (product) => {
    const stock = calculateRealStock(product);
    addToCart({ ...product, maxStock: stock });
    navigate('/cart');
  };

  // --- HÀM TÍNH TỒN KHO CHÍNH XÁC (FIX LỖI OUT OF STOCK) ---
  const calculateRealStock = (p) => {
    if (p.allow_external_key) return 999;
    
    // Nếu là hàng vật lý -> lấy cột physical_stock
    if (!p.is_digital) return p.physical_stock || 0;

    // Nếu là hàng số -> cộng tổng variant_stocks
    if (p.variant_stocks && Array.isArray(p.variant_stocks) && p.variant_stocks.length > 0) {
        return p.variant_stocks.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
    }

    // Fallback về cách cũ (lấy từ view stocks) hoặc đếm rows
    return stocks[p.id] || 0;
  };

  if (loadingProducts) return (
      <div className="min-h-[60vh] flex items-center justify-center">
          <Loader className="animate-spin text-blue-600" size={40} />
      </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header & Filter giữ nguyên */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">{t('Sản phẩm mới', 'Latest Products')}</h1>
          <p className="text-slate-500">{t('Danh sách các sản phẩm đang được bán', 'Browse our premium digital products')}</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
           <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder={t('Tìm kiếm...', 'Search products...')} 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
           </div>
           <select 
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-600 font-medium"
           >
              <option value="all">{t('Tất cả', 'All Types')}</option>
              <option value="digital">{t('Sản phẩm số', 'Digital')}</option>
              <option value="physical">{t('Vật lý', 'Physical')}</option>
           </select>
        </div>
      </div>

      {filtered.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {filtered.map(p => {
              // SỬ DỤNG HÀM TÍNH TỒN KHO MỚI
              const stockCount = calculateRealStock(p);
              const isAvailable = stockCount > 0;
              const hasVariants = p.variants && p.variants.length > 0;

              return (
                <div key={p.id} className="group bg-white rounded-2xl border border-slate-100 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 flex flex-col overflow-hidden">
                  
                  {/* Image Section */}
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-50">
                    <Link to={`/product/${p.id}`}>
                        {p.images && p.images.length > 0 ? (
                            <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <ShoppingBag size={40} />
                            </div>
                        )}
                    </Link>
                    
                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex flex-col gap-2">
                        {p.is_digital ? (
                            <span className="bg-blue-500/90 backdrop-blur text-white text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1">
                                <Zap size={10} fill="currentColor" /> Digital
                            </span>
                        ) : (
                            <span className="bg-amber-500/90 backdrop-blur text-white text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1">
                                <Box size={10} /> Physical
                            </span>
                        )}
                        {/* Hiển thị Auto API */}
                        {p.allow_external_key && (
                             <span className="bg-purple-500/90 backdrop-blur text-white text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1">
                                API
                            </span>
                        )}
                    </div>
                    
                    {!isAvailable && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                            <span className="bg-slate-800 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg">
                                {t('Hết hàng', 'Out of Stock')}
                            </span>
                        </div>
                    )}
                  </div>

                  {/* Content Section */}
                  <div className="p-4 flex flex-col flex-1">
                    <Link to={`/product/${p.id}`} className="block">
                        <h3 className="font-bold text-slate-700 leading-snug mb-1 group-hover:text-blue-600 transition line-clamp-2 min-h-[2.5rem]">
                            {lang === 'vi' ? p.title : (p.title_en || p.title)}
                        </h3>
                    </Link>
                    
                    <div className="flex items-center gap-2 mb-4">
                        <div className={`text-xs font-medium px-2 py-0.5 rounded-md ${isAvailable ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {isAvailable 
                                ? `${t('Còn', 'Stock')}: ${stockCount}` 
                                : t('Hết hàng', 'Out of Stock')
                            }
                        </div>
                        {hasVariants && (
                            <div className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 flex items-center gap-1">
                                <Layers size={10} /> {t('Có biến thể', 'Variants')}
                            </div>
                        )}
                    </div>

                    <div className="mt-auto pt-3 border-t border-slate-50 flex items-center justify-between gap-3">
                      <div className="font-bold text-lg text-blue-600">
                        {p.price.toLocaleString()} <span className="text-sm font-medium text-slate-400">USDT</span>
                      </div>

                      <div className="flex gap-2">
                         {hasVariants ? (
                             <Link to={`/product/${p.id}`} className="bg-slate-50 text-slate-700 py-2.5 px-3 rounded-xl font-bold hover:bg-slate-100 transition border border-slate-200 text-xs">
                                {t('Tùy chọn', 'Options')}
                             </Link>
                         ) : (
                             <button onClick={() => handleAddToCart(p)} disabled={!isAvailable} className="bg-slate-50 text-slate-700 py-2.5 px-3 rounded-xl font-bold hover:bg-slate-100 transition border border-slate-200 text-xs disabled:opacity-50 disabled:cursor-not-allowed">
                                {t('Thêm giỏ', 'Add Cart')}
                             </button>
                         )}

                         <button onClick={() => handleBuyNow(p)} disabled={!isAvailable} className="bg-blue-600 text-white py-2.5 px-3 rounded-xl font-bold hover:bg-blue-700 transition disabled:bg-gray-300 shadow-md text-xs shadow-blue-200 disabled:shadow-none">
                            {t('Mua ngay', 'Buy Now')}
                         </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
      ) : (
          <div className="text-center py-24 bg-white rounded-3xl border border-slate-100">
              <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400">
                  <Search size={40}/>
              </div>
              <h3 className="text-xl font-bold text-slate-700 mb-2">{t('Không tìm thấy sản phẩm', 'No products found')}</h3>
              <p className="text-slate-500">{t('Thử tìm kiếm với từ khóa khác xem sao.', 'Try searching with different keywords.')}</p>
          </div>
      )}
    </div>
  );
}
