import { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useLang } from '../context/LangContext';
import { ShoppingBag, Search, Zap, Box, Layers, ShoppingCart, CreditCard, Loader } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';

export default function Products() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  
  const { addToCart } = useCart();
  const { t, lang } = useLang();
  const navigate = useNavigate();

  // 1. Lấy danh sách sản phẩm KÈM biến thể để tính giá/ảnh
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['public-products'],
    queryFn: async () => {
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

  // 2. Lấy tồn kho từ View
  const { data: stocks = {} } = useQuery({
    queryKey: ['public-stock-variant'],
    queryFn: async () => {
      const { data, error } = await supabase.from('view_product_variant_stock').select('*');
      if (error) throw error;
      
      const { data: productsInfo } = await supabase.from('products').select('id, is_digital');
      
      // Map tồn kho theo ProductID
      const map = {};
      data?.forEach(row => {
          const pid = row.product_id;
          const pInfo = productsInfo?.find(item => item.id === pid);
          if (!map[pid]) map[pid] = 0;

          // Tính toán: (Digital/Physical Stock) - Pending Stock
          const baseStock = pInfo?.is_digital ? (row.digital_stock || 0) : (row.total_stock || 0);
          const available = Math.max(0, baseStock - (row.pending_stock || 0));
          
          map[pid] += available;
      });
      return map;
    }
  });

  // 3. Lọc sản phẩm (Tìm kiếm & Loại)
  const filteredProducts = useMemo(() => {
      return products.filter(p => {
          const pTitle = lang === 'vi' ? p.title : (p.title_en || p.title);
          const matchesSearch = pTitle.toLowerCase().includes(search.toLowerCase());
          const matchesType = filterType === 'all' 
              ? true 
              : filterType === 'digital' ? p.is_digital : !p.is_digital;
          return matchesSearch && matchesType;
      });
  }, [products, search, filterType, lang]);

  // Handler: Thêm vào giỏ (Chỉ cho SP không biến thể)
  const handleAddToCart = (p) => {
      const currentStock = stocks[p.id] || 0;
      addToCart({ ...p, maxStock: currentStock });
      toast.success(t("Đã thêm vào giỏ hàng!", "Added to cart successfully!"));
  };

  // Handler: Mua ngay
  const handleBuyNow = (p, hasVariants) => {
      if (hasVariants) {
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
      {/* HERO BANNER */}
      <section className="py-14 mb-10 bg-gradient-to-b from-blue-50 to-white rounded-3xl border border-blue-50/50 mx-4 mt-4">
        <div className="text-center max-w-2xl mx-auto px-4">
            <h1 className="text-4xl font-extrabold text-slate-800 mb-4">{t('Khám phá', 'Explore')} <span className="text-blue-600">CryptoShop</span></h1>
            <p className="text-slate-500 text-lg">{t('Danh sách sản phẩm chất lượng cao', 'High quality products list')}</p>
        </div>
      </section>

      {/* FILTER BAR */}
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm sticky top-20 z-30">
            <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                <input 
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition" 
                    placeholder={t('Tìm tên sản phẩm...', 'Search products...')} 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                />
            </div>
            <select 
                className="px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full md:w-auto cursor-pointer" 
                value={filterType} 
                onChange={e => setFilterType(e.target.value)}
            >
                <option value="all">{t('Tất cả', 'All')}</option>
                <option value="digital">Digital (Key)</option>
                <option value="physical">Physical (Ship)</option>
            </select>
        </div>

        {/* PRODUCT GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((p) => {
                const stock = stocks[p.id] || 0;
                const isAvailable = stock > 0 || p.allow_external_key;

                // --- LOGIC XỬ LÝ BIẾN THỂ ---
                // Chỉ tính các biến thể đang active
                const activeVariants = p.variants?.filter(v => v.is_active) || [];
                const hasVariants = activeVariants.length > 0;
                const firstVariant = hasVariants ? activeVariants[0] : null;

                // 1. Giá hiển thị: Nếu có biến thể -> Giá gốc + Mod của biến thể đầu
                const displayPrice = hasVariants 
                    ? p.price + (parseFloat(firstVariant.price_mod) || 0) 
                    : p.price;

                // 2. Ảnh hiển thị: Ưu tiên ảnh SP -> Ảnh biến thể -> Placeholder
                const displayImage = (p.images && p.images.length > 0) 
                    ? p.images[0] 
                    : (firstVariant && firstVariant.image ? firstVariant.image : 'https://via.placeholder.com/300?text=No+Image');

                return (
                <div key={p.id} className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-xl transition duration-300 border border-slate-100 flex flex-col group">
                    <Link to={`/product/${p.id}`} className="relative block h-52 overflow-hidden bg-gray-100">
                        <img 
                            src={displayImage} 
                            alt={p.title} 
                            className="w-full h-full object-cover transform group-hover:scale-105 transition duration-500" 
                        />
                        
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
                            <div className="flex flex-col mb-4">
                                <span className="text-green-600 font-extrabold text-xl">{displayPrice.toFixed(2)} USDT</span>
                                {hasVariants && <span className="text-[10px] text-slate-400 italic">{t('Giá từ...', 'From...')}</span>}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {/* NÚT 1: TÙY CHỌN hoặc THÊM GIỎ */}
                                {hasVariants ? (
                                    <Link to={`/product/${p.id}`} className="bg-slate-50 text-slate-700 py-2.5 rounded-xl font-bold hover:bg-slate-100 transition border border-slate-200 text-xs flex items-center justify-center gap-1">
                                        <Layers size={14}/> {t('Tùy chọn', 'Options')}
                                    </Link>
                                ) : (
                                    <button 
                                        onClick={() => handleAddToCart(p)} 
                                        disabled={!isAvailable} 
                                        className="bg-slate-50 text-slate-700 py-2.5 rounded-xl font-bold hover:bg-slate-100 transition border border-slate-200 text-xs disabled:opacity-50 flex items-center justify-center gap-1"
                                    >
                                        <ShoppingCart size={14}/> {t('Thêm giỏ', 'Add Cart')}
                                    </button>
                                )}

                                {/* NÚT 2: MUA NGAY */}
                                <button 
                                    onClick={() => handleBuyNow(p, hasVariants)} 
                                    disabled={!isAvailable} 
                                    className="bg-blue-600 text-white py-2.5 rounded-xl font-bold hover:bg-blue-700 transition disabled:bg-gray-300 shadow-md text-xs flex items-center justify-center gap-1"
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
      </div>
    </div>
  );
}
