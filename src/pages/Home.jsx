import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useLang } from '../context/LangContext';
import { Zap, Wallet, ShieldCheck, ShoppingBag, Layers, ShoppingCart, CreditCard } from 'lucide-react';
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
      const { data: stockRows } = await supabase.from('view_product_variant_stock').select('*');
      const { data: productsInfo } = await supabase.from('products').select('id, is_digital');
      
      const map = {};
      stockRows?.forEach(row => {
          const pid = row.product_id;
          const pInfo = productsInfo?.find(item => item.id === pid);
          if (!map[pid]) map[pid] = 0;
          
          // Xác định tồn kho gốc theo loại sản phẩm
          const baseStock = pInfo?.is_digital ? (row.digital_stock || 0) : (row.total_stock || 0);
          // Tồn kho khả dụng = Gốc - Đang giữ
          const available = Math.max(0, baseStock - (row.pending_stock || 0));
          
          map[pid] += available;
      });
      return map;
    }
  });

  const handleAddToCart = (p) => {
      const currentStock = stocks[p.id] || 0;
      addToCart({ ...p, maxStock: currentStock });
      toast.success(t("Đã thêm vào giỏ hàng!", "Added to cart!"));
  };

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
    <div>
      {/* === HERO SECTION (KHÔI PHỤC ĐÚNG GỐC) === */}
      <section className="py-16 mb-12 bg-gradient-to-b from-blue-50 to-white rounded-3xl mx-4 mt-4">
        <div className="text-center max-w-3xl mx-auto px-4">
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 mb-4 tracking-tight">
                {t('Mua sắm với', 'Shop with')} <span className="text-blue-600">Crypto</span>
            </h1>
            <p className="text-slate-500 text-lg mb-10 leading-relaxed">
                {t(
                    'Sản phẩm số và vật lý chất lượng cao với thanh toán cryptocurrency an toàn qua Oxapay.',
                    'High quality digital and physical products with secure cryptocurrency payments via Oxapay.'
                )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                {/* Feature 1 */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                        <Zap size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">{t('Giao hàng nhanh', 'Fast Delivery')}</h3>
                        <p className="text-xs text-slate-500">{t('Sản phẩm số tức thì', 'Instant digital items')}</p>
                    </div>
                </div>

                {/* Feature 2 */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600 flex-shrink-0">
                        <Wallet size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">{t('Thanh toán Crypto', 'Crypto Payment')}</h3>
                        <p className="text-xs text-slate-500">USDT, BTC, ETH</p>
                    </div>
                </div>

                {/* Feature 3 */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition">
                    <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 flex-shrink-0">
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">{t('Bảo mật cao', 'High Security')}</h3>
                        <p className="text-xs text-slate-500">{t('Giao dịch an toàn', 'Secure transactions')}</p>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* === PRODUCT LIST === */}
      <div className="container mx-auto px-4 pb-12">
        <h2 className="text-2xl font-bold mb-8 text-slate-800 flex items-center gap-2">
            <ShoppingBag className="text-blue-600"/> {t('Sản phẩm mới nhất', 'Latest Products')}
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {products.map((p) => {
            const stock = stocks[p.id] || 0;
            const isBuyable = stock > 0 || p.allow_external_key;

            // --- LOGIC XỬ LÝ BIẾN THỂ ---
            const activeVariants = p.variants?.filter(v => v.is_active) || [];
            const hasVariants = activeVariants.length > 0;
            const firstVariant = hasVariants ? activeVariants[0] : null;

            // 1. Giá: Nếu có biến thể -> Giá gốc + Mod của biến thể đầu
            const displayPrice = hasVariants 
                ? p.price + (parseFloat(firstVariant.price_mod) || 0) 
                : p.price;

            // 2. Ảnh: Ưu tiên ảnh SP -> Ảnh biến thể đầu -> Placeholder
            const displayImage = (p.images && p.images.length > 0) 
                ? p.images[0] 
                : (firstVariant && firstVariant.image ? firstVariant.image : 'https://via.placeholder.com/300?text=No+Image');

            return (
              <div key={p.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-xl transition duration-300 border border-slate-100 flex flex-col group">
                <Link to={`/product/${p.id}`}>
                  <div className="h-56 overflow-hidden bg-gray-100 relative">
                    <img src={displayImage} alt={p.title} className="w-full h-full object-cover transform group-hover:scale-105 transition duration-500" />
                    
                    {/* Badge Tồn kho */}
                    <div className={`absolute top-2 right-2 px-2 py-1 text-[10px] font-bold rounded text-white ${isBuyable ? 'bg-green-500' : 'bg-red-500'}`}>
                       {isBuyable ? `${t('Sẵn hàng', 'In Stock')}: ${stock}` : t('Hết hàng', 'Out of Stock')}
                    </div>
                  </div>
                </Link>
                
                <div className="p-5 flex flex-col flex-grow">
                  <Link to={`/product/${p.id}`}>
                    <h3 className="font-bold text-lg mb-2 text-slate-800 hover:text-blue-600 transition truncate">
                        {lang === 'vi' ? p.title : (p.title_en || p.title)}
                    </h3>
                  </Link>
                  
                  <div className="mt-auto">
                    <div className="flex justify-between items-center mb-4">
                       <div className="flex flex-col">
                           <span className="text-green-600 font-bold text-xl">{displayPrice.toFixed(2)} USDT</span>
                           {hasVariants && <span className="text-[10px] text-slate-400 italic">{t('Giá từ...', 'From...')}</span>}
                       </div>
                       
                       {p.is_digital ? 
                          <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-100 font-bold">DIGITAL</span> :
                          <span className="text-[10px] bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-100 font-bold">PHYSICAL</span>
                       }
                    </div>

                    <div className="flex gap-2">
                       {/* NÚT TỰ ĐỘNG THAY ĐỔI: TÙY CHỌN hoặc THÊM GIỎ */}
                       <button 
                          onClick={() => handleOptionOrAdd(p, hasVariants)} 
                          disabled={!isBuyable}
                          className={`flex-1 py-2 rounded-lg font-medium transition border text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1
                              ${hasVariants 
                                  ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' 
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                       >
                          {hasVariants ? <><Layers size={16}/> {t('Tùy chọn', 'Options')}</> : <><ShoppingCart size={16}/> {t('Thêm giỏ', 'Add Cart')}</>}
                       </button>

                       <button 
                          onClick={() => handleBuyNow(p, hasVariants)} 
                          disabled={!isBuyable} 
                          className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition disabled:bg-gray-300 shadow-md text-sm"
                       >
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
    </div>
  );
}


