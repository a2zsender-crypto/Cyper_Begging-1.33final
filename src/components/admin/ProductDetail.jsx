import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useCart } from '../context/CartContext';
import { useLang } from '../context/LangContext';
import { ShoppingCart, CreditCard, CheckCircle, Tag, AlertTriangle, Zap, Box } from 'lucide-react'; 
import { toast } from 'react-toastify';

export default function ProductDetail() {
  const { id } = useParams();
  const { addToCart, cart } = useCart(); // Lấy thêm cart để check số lượng hiện tại
  const { lang, t } = useLang();
  const navigate = useNavigate();
  
  const [product, setProduct] = useState(null);
  const [mainImg, setMainImg] = useState('');
  
  const [selectedOptions, setSelectedOptions] = useState({});
  const [finalPrice, setFinalPrice] = useState(0);
  const [currentStock, setCurrentStock] = useState(0); 

  useEffect(() => {
    supabase.from('products').select('*').eq('id', id).single().then(async ({ data }) => {
      if (data) {
          setProduct(data);
          if (data.images?.length) setMainImg(data.images[0]);
          setFinalPrice(data.price);
          
          if (data.variants && Array.isArray(data.variants)) {
              const defaults = {};
              data.variants.forEach(v => {
                  if (v.options && v.options.length > 0) {
                      defaults[v.name] = v.options[0].label;
                  }
              });
              setSelectedOptions(defaults);
          } else {
              // Load stock ban đầu
              checkStock(data, {});
          }
      }
    });
  }, [id]);

  // --- SỬA ĐỔI: HÀM CHECK STOCK CHUẨN XÁC (REALTIME) ---
  const checkStock = async (prod, options) => {
      if (!prod) return;
      
      if (prod.is_digital) {
          // NẾU LÀ DIGITAL: ĐẾM TRỰC TIẾP TỪ TABLE KEY (Bỏ qua physical_stock của products vì có thể sai cache)
          const { count, error } = await supabase
            .from('product_keys')
            .select('*', { count: 'exact', head: true })
            .eq('product_id', prod.id)
            .eq('is_used', false)
            .contains('variant_info', options); // Lọc theo variant info
           
           if(error) console.error("Check stock error:", error);
           setCurrentStock(count || 0);
      } else {
          // NẾU LÀ VẬT LÝ
          if (prod.variant_stocks && prod.variant_stocks.length > 0) {
              const stockItem = prod.variant_stocks.find(item => {
                  const itemOpts = item.options;
                  const selectedKeys = Object.keys(options);
                  if (Object.keys(itemOpts).length !== selectedKeys.length) return false;
                  return selectedKeys.every(key => itemOpts[key] === options[key]);
              });
              setCurrentStock(stockItem ? parseInt(stockItem.stock) : 0);
          } else {
              setCurrentStock(prod.physical_stock || 0);
          }
      }
  };

  useEffect(() => {
      if (!product) return;
      
      let extra = 0;
      if (product.variants) {
          product.variants.forEach(v => {
              const selectedLabel = selectedOptions[v.name];
              const optionData = v.options.find(o => o.label === selectedLabel);
              if (optionData && optionData.price_mod) extra += parseFloat(optionData.price_mod);
          });
      }
      setFinalPrice(product.price + extra);

      // Gọi check stock mỗi khi đổi option
      checkStock(product, selectedOptions);

  }, [selectedOptions, product]);

  const handleOptionChange = (variantName, value) => {
      setSelectedOptions(prev => ({ ...prev, [variantName]: value }));
      const variantGroup = product.variants.find(v => v.name === variantName);
      if (variantGroup) {
          const selectedOpt = variantGroup.options.find(o => o.label === value);
          if (selectedOpt && selectedOpt.image) setMainImg(selectedOpt.image);
      }
  };

  // Chuẩn bị object để thêm vào giỏ
  const getProductToAdd = () => ({ 
      ...product, 
      price: finalPrice, 
      selectedVariants: selectedOptions,
      maxStock: currentStock // TRUYỀN MAX STOCK VÀO GIỎ HÀNG
  });

  const isOutOfStock = currentStock <= 0 && !product?.allow_external_key;

  const handleAddToCart = () => {
      if(isOutOfStock) return toast.error(t("Sản phẩm tạm hết hàng!", "Out of stock!"));
      
      // Check thêm lần nữa ở client trước khi gọi context (UX)
      // Tìm xem trong giỏ đã có bao nhiêu cái này rồi
      const currentCartItem = cart.find(i => 
          i.id === product.id && JSON.stringify(i.selectedVariants) === JSON.stringify(selectedOptions)
      );
      const currentQty = currentCartItem ? currentCartItem.quantity : 0;
      
      // Nếu không phải API mode và số lượng thêm > kho
      if (!product.allow_external_key && (currentQty + 1 > currentStock)) {
          return toast.warn(t(`Bạn đã có ${currentQty} sản phẩm trong giỏ. Kho chỉ còn ${currentStock}.`, `You have ${currentQty} in cart. Stock: ${currentStock}`));
      }

      if(product) { 
          addToCart(getProductToAdd()); 
          toast.success(t("Đã thêm vào giỏ hàng!", "Added to cart!")); 
      }
  }

  const handleBuyNow = () => {
      if(isOutOfStock) return toast.error(t("Sản phẩm tạm hết hàng!", "Out of stock!"));
      
      // Check stock logic tương tự
      const currentCartItem = cart.find(i => 
          i.id === product.id && JSON.stringify(i.selectedVariants) === JSON.stringify(selectedOptions)
      );
      const currentQty = currentCartItem ? currentCartItem.quantity : 0;

      if (!product.allow_external_key && (currentQty + 1 > currentStock)) {
          return toast.warn(t("Không đủ hàng trong kho để mua thêm!", "Not enough stock!"));
      }

      if(product) { 
          addToCart(getProductToAdd()); 
          navigate('/cart'); 
      }
  }

  if (!product) return <div className="flex justify-center items-center h-64 text-slate-400">Loading...</div>;

  const displayTitle = lang === 'vi' ? product.title : (product.title_en || product.title);
  const displayDesc = lang === 'vi' ? product.description : (product.description_en || product.description);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 md:flex gap-10">
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

        <div className="md:w-1/2 mt-8 md:mt-0 flex flex-col">
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 mb-4 leading-tight">{displayTitle}</h1>
          <div className="flex items-center gap-4 mb-6">
             <div className="text-3xl font-extrabold text-green-600">{finalPrice.toFixed(2)} USDT</div>
             {product.is_digital ? <span className="flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full uppercase"><Zap size={12}/> Digital Key</span> : <span className="flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full uppercase"><Box size={12}/> Physical</span>}
          </div>

          <div className={`mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold ${!isOutOfStock ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {!isOutOfStock ? (
                  <><CheckCircle size={16}/> {product.allow_external_key && currentStock <=0 ? t('Sẵn hàng', 'In Stock') : `${t('Sẵn hàng', 'In Stock')}: ${currentStock}`}</>
              ) : (
                  <><AlertTriangle size={16}/> {t('Hết hàng', 'Out of Stock')}</>
              )}
          </div>

          {product.variants && product.variants.length > 0 && (
              <div className="mb-6 space-y-4 p-5 bg-slate-50 rounded-xl border border-slate-100">
                  {product.variants.map((variant, idx) => (
                      <div key={idx}>
                          <p className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1"><Tag size={14}/> {variant.name}</p>
                          <div className="flex flex-wrap gap-2">
                              {variant.options.map((opt, optIdx) => {
                                  const displayLabel = lang === 'vi' ? opt.label : (opt.label_en || opt.label);
                                  const isSelected = selectedOptions[variant.name] === opt.label; 
                                  return (
                                      <button key={optIdx} onClick={() => handleOptionChange(variant.name, opt.label)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'}`}>
                                          {displayLabel} {parseFloat(opt.price_mod) > 0 && <span className="text-xs opacity-75 ml-1">(+${opt.price_mod})</span>}
                                      </button>
                                  )
                              })}
                          </div>
                      </div>
                  ))}
              </div>
          )}
          
          <div className="prose max-w-none text-slate-600 mb-8 whitespace-pre-wrap border-t border-slate-100 pt-6 text-base leading-relaxed">
            {displayDesc || (lang === 'en' ? "No description available." : "Chưa có mô tả chi tiết.")}
          </div>

          <div className="mt-auto space-y-4">
            <div className="flex gap-4">
              <button onClick={handleAddToCart} disabled={isOutOfStock} className="flex-1 bg-white border-2 border-blue-600 text-blue-600 py-3.5 rounded-xl font-bold hover:bg-blue-50 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                <ShoppingCart size={20}/> {t('THÊM GIỎ HÀNG', 'ADD TO CART')}
              </button>
              <button onClick={handleBuyNow} disabled={isOutOfStock} className="flex-1 bg-red-600 text-white py-3.5 rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:shadow-none disabled:cursor-not-allowed">
                <CreditCard size={20}/> {t('MUA NGAY', 'BUY NOW')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
