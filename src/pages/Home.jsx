import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useLang } from '../context/LangContext';
import { Zap, Wallet, ShieldCheck, ShoppingBag } from 'lucide-react';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [stocks, setStocks] = useState({});
  const { addToCart } = useCart();
  const { t, lang } = useLang();
  const navigate = useNavigate();

  useEffect(() => {
    // Lấy danh sách sản phẩm
    supabase.from('products').select('*').order('id', { ascending: false }).then(({ data }) => setProducts(data || []));
    
    // Lấy tồn kho (Yêu cầu phải có View product_stock trong DB)
    supabase.from('product_stock').select('*').then(({ data }) => {
       const map = {};
       data?.forEach(s => map[s.product_id] = s.stock_count);
       setStocks(map);
    });
  }, []);

  // [SỬA LỖI] Tính toán maxStock trước khi thêm vào giỏ
  const handleAddToCart = (p) => {
      const currentStock = stocks[p.id] || 0;
      // Merge thêm maxStock để CartContext không chặn nhầm
      addToCart({ ...p, maxStock: currentStock });
      alert(t("Đã thêm vào giỏ hàng!", "Added to cart successfully!"));
  };

  // [SỬA LỖI] Tương tự cho hàm mua ngay
  const handleBuyNow = (p) => {
      const currentStock = stocks[p.id] || 0;
      addToCart({ ...p, maxStock: currentStock });
      navigate('/cart');
  }

  return (
    <div>
      {/* === HERO SECTION === */}
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
      <h2 className="text-2xl font-bold mb-8 text-slate-800 flex items-center gap-2">
          <ShoppingBag className="text-blue-600"/> {t('Sản phẩm mới nhất', 'Latest Products')}
      </h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
        {products.map((p) => {
          const stock = stocks[p.id] || 0;
          // [LOGIC MỚI] Kiểm tra xem có thể mua được không (Stock > 0 HOẶC cho phép key ngoài)
          const isBuyable = stock > 0 || p.allow_external_key;
          
          return (
            <div key={p.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-xl transition duration-300 border border-slate-100 flex flex-col group">
              <Link to={`/product/${p.id}`}>
                <div className="h-56 overflow-hidden bg-gray-100 relative">
                  {p.images && p.images[0] ? (
                    <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover transform group-hover:scale-105 transition duration-500" />
                  ) : <div className="flex items-center justify-center h-full text-gray-400">No Image</div>}
                  
                  {/* Badge Tồn kho */}
                  <div className={`absolute top-2 right-2 px-2 py-1 text-[10px] font-bold rounded text-white ${isBuyable ? 'bg-green-500' : 'bg-red-500'}`}>
                     {isBuyable 
                        ? (stock > 0 ? `${t('Sẵn hàng', 'In Stock')}: ${stock}` : t('Sẵn hàng', 'In Stock')) 
                        : t('Hết hàng', 'Out of Stock')
                     }
                  </div>
                </div>
              </Link>
              
              <div className="p-5 flex flex-col flex-grow">
                <Link to={`/product/${p.id}`}>
                  {/* Tên sản phẩm theo ngôn ngữ */}
                  <h3 className="font-bold text-lg mb-2 text-slate-800 hover:text-blue-600 transition truncate">
                      {lang === 'vi' ? p.title : (p.title_en || p.title)}
                  </h3>
                </Link>
                
                <div className="mt-auto">
                  <div className="flex justify-between items-center mb-4">
                     {/* Giá USDT */}
                     <span className="text-green-600 font-bold text-xl">{p.price} USDT</span>
                     
                     {/* Badge loại sản phẩm */}
                     {p.is_digital ? 
                        <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-100 font-bold">DIGITAL</span> :
                        <span className="text-[10px] bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-100 font-bold">PHYSICAL</span>
                     }
                  </div>

                  <div className="flex gap-2">
                     <button 
                        onClick={() => handleAddToCart(p)} 
                        // Cho phép thêm giỏ nếu stock > 0 HOẶC allow_external_key = true
                        disabled={!isBuyable}
                        className="flex-1 bg-white text-slate-700 py-2 rounded-lg font-medium hover:bg-slate-50 transition border border-slate-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                        {t('Thêm giỏ', 'Add to Cart')}
                     </button>
                     <button 
                        onClick={() => handleBuyNow(p)} 
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
  );
}
