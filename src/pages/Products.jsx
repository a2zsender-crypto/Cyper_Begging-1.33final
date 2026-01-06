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

  // 1. Dùng React Query để lấy Sản phẩm (Tự động Cache)
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['public-products'], // Key định danh cache
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('id', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // 2. Dùng React Query để lấy Tồn kho
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
      // Logic cũ cho sản phẩm không có biến thể
      addToCart(p);
      toast.success(t("Đã thêm vào giỏ hàng!", "Added to cart successfully!"));
  };

  const handleBuyNow = (p) => {
      // Nếu có biến thể, chuyển vào trang chi tiết để chọn
      if (p.variants && p.variants.length > 0) {
          navigate(`/product/${p.id}`);
      } else {
          addToCart(p);
          navigate('/cart');
      }
  }

  // Loading state đẹp hơn
  if (loadingProducts) return (
      <div className="flex justify-center items-center h-screen text-blue-600">
          <Loader className="animate-spin w-10 h-10"/>
      </div>
  );

  return (
    <div className="pb-10">
      
      {/* HERO BANNER */}
      <section className="py-14 mb-10 bg-gradient-to-b from-blue-50 to-white rounded-3xl border border-blue-50/50">
        <div className="text-center max-w-2xl mx-auto px-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mb-4">
                <Package size={14}/> {t('Kho hàng chính hãng', 'Official Inventory')}
            </div>
            <h1 className="text-4xl font-extrabold text-slate-800 mb-4">
                {t('Khám phá', 'Explore')} <span className="text-blue-600">CryptoShop</span>
            </h1>
            <p className="text-slate-500 text-lg">
                {t('Tìm kiếm sản phẩm số và vật lý chất lượng cao. Thanh toán nhanh chóng, an toàn.', 'Find high-quality digital and physical products. Fast, safe, and secure payment.')}
            </p>
        </div>
      </section>

      {/* TOOLBAR */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm sticky top-20 z-30">
          <div className="flex items-center gap-2">
              <Layers className="text-blue-600"/>
              <h2 className="font-bold text-slate-700 text-lg">
                  {t('Tất cả sản phẩm', 'All Products')} <span className="text-slate-400 text-sm font-normal">({filteredProducts.length})</span>
              </h2>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-72">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input 
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-slate-50 focus:bg-white"
                    placeholder={t('Tìm tên sản phẩm...', 'Search products...')}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
              </div>
              <select 
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium text-slate-600"
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
              >
                  <option value="all">{t('Tất cả loại', 'All Types')}</option>
                  <option value="digital">Digital (Key)</option>
                  <option value="physical">Physical (Ship)</option>
              </select>
          </div>
      </div>

      {/* GRID */}
      {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((p) => {
              const stock = stocks[p.id] || 0;
              // Kiểm tra xem sản phẩm có biến thể hay không
              const hasVariants = p.variants && Array.isArray(p.variants) && p.variants.length > 0;

              return (
                <div key={p.id} className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-xl transition duration-300 border border-slate-100 flex flex-col group">
                  <Link to={`/product/${p.id}`} className="relative block h-52 overflow-hidden bg-gray-100">
                      {p.images && p.images[0] ? (
                        <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover transform group-hover:scale-105 transition duration-500" />
                      ) : <div className="flex items-center justify-center h-full text-gray-400">No Image</div>}
                      
                      <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg text-white shadow-sm ${stock > 0 ? 'bg-green-500' : 'bg-red-500'}`}>
                             {stock > 0 ? `${t('Sẵn hàng', 'In Stock')}: ${stock}` : t('Hết hàng', 'Out of Stock')}
                          </span>
                          {p.is_digital ? 
                             <span className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-purple-600 text-white shadow-sm backdrop-blur-md bg-opacity-90"><Zap size={10}/> DIGITAL</span> :
                             <span className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-orange-500 text-white shadow-sm backdrop-blur-md bg-opacity-90"><Box size={10}/> PHYSIC</span>
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
                         {hasVariants && <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500 font-medium">Many options</span>}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                         {/* NÚT THÊM GIỎ HÀNG: CÓ LOGIC VARIANT */}
                         {hasVariants ? (
                             <Link to={`/product/${p.id}`} className="bg-slate-50 text-slate-700 py-2.5 rounded-xl font-bold hover:bg-slate-100 transition border border-slate-200 text-xs flex items-center justify-center">
                                {t('Tùy chọn', 'Options')}
                             </Link>
                         ) : (
                             <button onClick={() => handleAddToCart(p)} className="bg-slate-50 text-slate-700 py-2.5 rounded-xl font-bold hover:bg-slate-100 transition border border-slate-200 text-xs">
                                {t('Thêm giỏ', 'Add Cart')}
                             </button>
                         )}

                         <button onClick={() => handleBuyNow(p)} disabled={stock===0} className="bg-blue-600 text-white py-2.5 rounded-xl font-bold hover:bg-blue-700 transition disabled:bg-gray-300 shadow-md text-xs shadow-blue-200">
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