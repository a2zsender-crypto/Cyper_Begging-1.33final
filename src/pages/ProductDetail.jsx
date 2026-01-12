import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useCart } from '../context/CartContext';
import { useLang } from '../context/LangContext';
import { ShoppingCart, CreditCard, CheckCircle, Tag, AlertTriangle, Zap, Box } from 'lucide-react'; 
import { toast } from 'react-toastify';

export default function ProductDetail() {
  const { id } = useParams();
  const { addToCart, cart } = useCart();
  const { lang, t } = useLang();
  const navigate = useNavigate();
  
  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]); // Dữ liệu từ bảng product_variants
  const [mainImg, setMainImg] = useState('');
  
  // Thay vì lưu option text, ta lưu ID của biến thể được chọn
  const [selectedVariantId, setSelectedVariantId] = useState(null); 
  
  const [finalPrice, setFinalPrice] = useState(0);
  const [currentStock, setCurrentStock] = useState(0); 
  const [loadingStock, setLoadingStock] = useState(true);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
      // 1. Lấy thông tin SP
      const { data: prod } = await supabase.from('products').select('*').eq('id', id).single();
      if (!prod) return;

      // 2. Lấy danh sách biến thể (Variant Table)
      const { data: vars } = await supabase
          .from('product_variants')
          .select('*')
          .eq('product_id', id)
          .order('price_mod', { ascending: true }); // Sắp xếp theo giá tăng dần

      setProduct(prod);
      setVariants(vars || []);
      if (prod.images?.length) setMainImg(prod.images[0]);
      setFinalPrice(prod.price);

      // Auto select biến thể đầu tiên
      if (vars && vars.length > 0) {
          setSelectedVariantId(vars[0].id);
      } else {
          // Không có biến thể -> Check stock chung
          checkStock(prod, null);
      }
  };

  // --- HÀM CHECK STOCK REALTIME ---
  const checkStock = async (prod, variantId) => {
      setLoadingStock(true);
      try {
          if (prod.is_digital) {
              // Gọi hàm mới: gửi variant_id cụ thể
              const { data: count, error } = await supabase.rpc('get_digital_stock', {
                  p_product_id: prod.id,
                  p_variant_id: variantId
              });
              
              if (error) throw error;
              setCurrentStock(count || 0);

          } else {
              // Logic hàng vật lý (giữ nguyên hoặc nâng cấp sau)
              setCurrentStock(prod.physical_stock || 0);
          }
      } catch (err) {
          console.error("Stock err:", err);
          setCurrentStock(0);
      } finally {
          setLoadingStock(false);
      }
  };

  // Khi thay đổi biến thể -> Tính lại giá & Check stock
  useEffect(() => {
      if (!product) return;
      
      let extra = 0;
      if (selectedVariantId && variants.length > 0) {
          const v = variants.find(x => x.id === selectedVariantId);
          if (v) extra = v.price_mod || 0;
          checkStock(product, selectedVariantId);
      } else {
          // Check stock sp gốc (không biến thể)
          if (product && variants.length === 0) checkStock(product, null);
      }
      
      setFinalPrice(product.price + extra);

  }, [selectedVariantId, product, variants]);

  const getProductToAdd = () => {
      const selectedVar = variants.find(v => v.id === selectedVariantId);
      return { 
          ...product, 
          price: finalPrice, 
          // Gửi thông tin chuẩn xuống giỏ hàng
          variant_id: selectedVariantId,
          variant_name: selectedVar ? selectedVar.name : null,
          variant_sku: selectedVar ? selectedVar.sku : null, // VINA50
          maxStock: currentStock 
      };
  };

  const isOutOfStock = !loadingStock && currentStock <= 0 && !product?.allow_api_restock;

  const handleAddToCart = () => {
      if (loadingStock) return;
      if (isOutOfStock) return toast.error(t("Sản phẩm tạm hết hàng!", "Out of stock!"));
      
      const itemToAdd = getProductToAdd();
      
      // Check số lượng trong giỏ
      const currentCartItem = cart.find(i => 
          i.id === product.id && i.variant_id === selectedVariantId
      );
      const currentQty = currentCartItem ? currentCartItem.quantity : 0;
      
      if (!product.allow_api_restock && (currentQty + 1 > currentStock)) {
          return toast.warn(t(`Kho chỉ còn ${currentStock} sản phẩm.`, `Only ${currentStock} left in stock.`));
      }

      addToCart(itemToAdd); 
      toast.success(t("Đã thêm vào giỏ hàng!", "Added to cart!")); 
  }

  const handleBuyNow = () => {
      if (loadingStock) return;
      if (isOutOfStock) return toast.error(t("Sản phẩm tạm hết hàng!", "Out of stock!"));
      
      const itemToAdd = getProductToAdd();
      const currentCartItem = cart.find(i => 
          i.id === product.id && i.variant_id === selectedVariantId
      );
      const currentQty = currentCartItem ? currentCartItem.quantity : 0;

      if (!product.allow_api_restock && (currentQty + 1 > currentStock)) {
          return toast.warn(t("Không đủ hàng trong kho!", "Not enough stock!"));
      }

      addToCart(itemToAdd); 
      navigate('/cart'); 
  }

  if (!product) return <div className="flex justify-center items-center h-64 text-slate-400">Loading...</div>;

  const displayTitle = lang === 'vi' ? product.title : (product.title_en || product.title);
  const displayDesc = lang === 'vi' ? product.description : (product.description_en || product.description);

  return (
    <div className="container mx-auto px-4 py-8 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 md:flex gap-10">
        {/* ẢNH SẢN PHẨM */}
        <div className="md:w-1/2 flex flex-col gap-4">
          <div className="h-80 md:h-96 bg-gray-50 rounded-2xl overflow-hidden border border-slate-100 flex items-center justify-center p-4">
            <img src={mainImg} alt={displayTitle} className="w-full h-full object-contain hover:scale-105 transition duration-500" />
          </div>
          {product.images?.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {product.images.map((img, idx) => (
                <img key={idx} src={img} onClick={() => setMainImg(img)} className={`w-20 h-20 object-cover rounded-xl cursor-pointer border-2 transition ${mainImg === img ? 'border-blue-600 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`} />
              ))}
            </div>
          )}
        </div>

        {/* THÔNG TIN */}
        <div className="md:w-1/2 mt-8 md:mt-0 flex flex-col">
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 mb-4 leading-tight">{displayTitle}</h1>
          <div className="flex items-center gap-4 mb-6">
             <div className="text-3xl font-extrabold text-green-600">{finalPrice.toLocaleString()} USDT</div>
             {product.is_digital ? <span className="flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full uppercase"><Zap size={12}/> Digital Key</span> : <span className="flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full uppercase"><Box size={12}/> Physical</span>}
          </div>

          <div className={`mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold ${!isOutOfStock ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {loadingStock ? (
                  <span className="animate-pulse">Checking stock...</span>
              ) : !isOutOfStock ? (
                  <><CheckCircle size={16}/> {product.allow_api_restock && currentStock <=0 ? t('Sẵn hàng (API)', 'In Stock') : `${t('Sẵn hàng', 'In Stock')}: ${currentStock}`}</>
              ) : (
                  <><AlertTriangle size={16}/> {t('Hết hàng', 'Out of Stock')}</>
              )}
          </div>

          {/* DANH SÁCH BIẾN THỂ TỪ DB MỚI */}
          {variants.length > 0 && (
              <div className="mb-6 space-y-4 p-5 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1"><Tag size={14}/> {t('Phân loại', 'Variants')}</p>
                  <div className="flex flex-wrap gap-2">
                      {variants.map((v) => {
                          const isSelected = selectedVariantId === v.id; 
                          return (
                              <button key={v.id} onClick={() => setSelectedVariantId(v.id)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'}`}>
                                  {v.name} {v.price_mod > 0 && <span className="text-xs opacity-75 ml-1">(+${v.price_mod})</span>}
                              </button>
                          )
                      })}
                  </div>
              </div>
          )}
          
          <div className="prose max-w-none text-slate-600 mb-8 whitespace-pre-wrap border-t border-slate-100 pt-6 text-base leading-relaxed">
            {displayDesc || (lang === 'en' ? "No description available." : "Chưa có mô tả chi tiết.")}
          </div>

          <div className="mt-auto space-y-4">
            <div className="flex gap-4">
              <button onClick={handleAddToCart} disabled={isOutOfStock || loadingStock} className="flex-1 bg-white border-2 border-blue-600 text-blue-600 py-3.5 rounded-xl font-bold hover:bg-blue-50 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                <ShoppingCart size={20}/> {t('THÊM GIỎ HÀNG', 'ADD TO CART')}
              </button>
              <button onClick={handleBuyNow} disabled={isOutOfStock || loadingStock} className="flex-1 bg-red-600 text-white py-3.5 rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:shadow-none disabled:cursor-not-allowed">
                <CreditCard size={20}/> {t('MUA NGAY', 'BUY NOW')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
