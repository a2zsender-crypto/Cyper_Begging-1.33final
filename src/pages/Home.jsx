import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useLang } from '../context/LangContext';
import { Zap, Wallet, ShieldCheck, ShoppingBag, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Home() {
  const [products, setProducts] = useState([]);
  const { addToCart } = useCart();
  const { t, lang } = useLang();
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .order('id', { ascending: false })
      .limit(12)
      .then(({ data }) => setProducts(data || []));
  }, []);

  // --- LOGIC CHECK STOCK CHÍNH XÁC ---
  const checkAvailability = (p) => {
      // 1. Dùng đúng tên cột allow_external_key
      if (p.is_digital && p.allow_external_key) return true;
      // 2. Fallback sang tồn kho vật lý
      return (p.physical_stock > 0);
  };

  const getStockLabel = (p) => {
      if (p.is_digital && p.allow_external_key) return { text: t("Auto API", "Auto API"), color: "bg-blue-500" };
      if (p.physical_stock > 0) return { text: `${t("Sẵn hàng", "In Stock")}`, color: "bg-green-500" };
      return { text: t("Hết hàng", "Out of Stock"), color: "bg-red-500" };
  };

  const handleAddToCart = (p) => {
      if (!checkAvailability(p)) {
          toast.error(t("Sản phẩm tạm hết hàng", "Out of Stock temporarily"));
          return;
      }
      const defaultVariant = p.variants?.length > 0 && p.variant_stocks?.length > 0
          ? p.variant_stocks[0].options 
          : null;
      addToCart(p, defaultVariant);
      toast.success(t("Đã thêm vào giỏ hàng!", "Added to cart!"));
  };

  const handleBuyNow = (p) => {
      if (!checkAvailability(p)) {
          toast.error(t("Sản phẩm tạm hết hàng", "Out of Stock temporarily"));
          return;
      }
      const defaultVariant = p.variants?.length > 0 && p.variant_stocks?.length > 0
          ? p.variant_stocks[0].options 
          : null;
      addToCart(p, defaultVariant);
      navigate('/cart');
  }

  return (
    <div>
      {/* Hero Section */}
      <section className="py-16 mb-12 bg-gradient-to-b from-blue-50 to-white rounded-3xl">
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
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white flex-shrink-0"><Zap size={24} /></div>
                    <div><h3 className="font-bold text-slate-800">{t('Giao hàng nhanh', 'Fast Delivery')}</h3><p className="text-xs text-slate-500">{t('Sản phẩm số tức thì', 'Instant digital items')}</p></div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600 flex-shrink-0"><Wallet size={24} /></div>
                    <div><h3 className="font-bold text-slate-800">{t('Thanh toán Crypto', 'Crypto Payment')}</h3><p className="text-xs text-slate-500">USDT, BTC, ETH</p></div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition">
                    <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 flex-shrink-0"><ShieldCheck size={24} /></div>
                    <div><h3 className="font-bold text-slate-800">{t('Bảo mật cao', 'High Security')}</h3><p className="text-xs text-slate-500">{t('Giao dịch an toàn', 'Secure transactions')}</p></div>
                </div>
            </div>
        </div>
      </section>

      {/* Product List */}
      <h2 className="text-2xl font-bold mb-8 text-slate-800 flex items-center gap-2">
          <ShoppingBag className="text-blue-600"/> {t('Sản phẩm mới nhất', 'Latest Products')}
      </h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((p) => {
          const isAvailable = checkAvailability(p);
          const stockLabel = getStockLabel(p);

          return (
            <div key={p.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-xl transition duration-300 border border-slate-100 flex flex-col group h-full">
              <Link to={`/products/${p.id}`} className="block relative">
                <div className="aspect-[4/3] overflow-hidden bg-gray-100 relative">
                  {p.images && p.images[0] ? (
                    <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover transform group-hover:scale-105 transition duration-500" />
                  ) : <div className="flex items-center justify-center h-full text-gray-400">No Image</div>}
                  
                  <div className={`absolute top-2 right-2 px-2 py-1 text-[10px] font-bold rounded text-white shadow-sm flex items-center gap-1 ${stockLabel.color}`}>
                     {isAvailable ? <Check size={10}/> : <X size={10}/>}
                     {stockLabel.text}
                  </div>

                  <div className="absolute top-2 left-2">
                      {p.is_digital ? 
                        <span className="text-[10px] bg-purple-600/90 text-white px-2 py-1 rounded font-bold backdrop-blur-sm shadow-sm">DIGITAL</span> :
                        <span className="text-[10px] bg-orange-500/90 text-white px-2 py-1 rounded font-bold backdrop-blur-sm shadow-sm">PHYSICAL</span>
                     }
                  </div>
                </div>
              </Link>
              
              <div className="p-4 flex flex-col flex-grow">
                <Link to={`/products/${p.id}`}>
                  <h3 className="font-bold text-slate-800 mb-1 hover:text-blue-600 transition line-clamp-2 min-h-[2.5rem]">
                      {lang === 'vi' ? p.title : (p.title_en || p.title)}
                  </h3>
                </Link>
                
                <div className="mt-auto pt-3 border-t border-slate-50">
                  <div className="flex justify-between items-center mb-3">
                     <span className="text-green-600 font-bold text-lg">{p.price} USDT</span>
                  </div>

                  <div className="flex gap-2">
                     <button onClick={() => handleAddToCart(p)} disabled={!isAvailable} className={`flex-1 py-2 rounded-lg font-medium transition text-sm border ${!isAvailable ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'}`}>
                        {t('Thêm giỏ', 'Add Cart')}
                     </button>
                     <button onClick={() => handleBuyNow(p)} disabled={!isAvailable} className={`flex-1 py-2 rounded-lg font-bold transition text-sm shadow-sm ${!isAvailable ? 'bg-gray-300 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
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
