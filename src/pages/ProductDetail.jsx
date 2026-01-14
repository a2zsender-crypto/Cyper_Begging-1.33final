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
  const [skus, setSkus] = useState([]); // State mới: Lưu danh sách các biến thể con (SKU)
  const [mainImg, setMainImg] = useState('');
  
  const [selectedOptions, setSelectedOptions] = useState({});
  const [finalPrice, setFinalPrice] = useState(0);
  const [currentStock, setCurrentStock] = useState(0); 
  const [loadingStock, setLoadingStock] = useState(true);

  // --- FETCH DATA ---
  useEffect(() => {
    const fetchData = async () => {
        setLoadingStock(true);
        // 1. Lấy thông tin sản phẩm cha
        const { data: prodData, error: prodError } = await supabase.from('products').select('*').eq('id', id).single();
        
        if (prodData) {
            setProduct(prodData);
            if (prodData.images?.length) setMainImg(prodData.images[0]);
            setFinalPrice(prodData.price);
            
            // Mặc định chọn option đầu tiên của mỗi nhóm
            if (prodData.variants && Array.isArray(prodData.variants)) {
                const defaults = {};
                prodData.variants.forEach(v => {
                    if (v.options && v.options.length > 0) {
                        defaults[v.name] = v.options[0].label;
                    }
                });
                setSelectedOptions(defaults);
            }

            // 2. Lấy danh sách các biến thể con (SKU) từ bảng 'product_variants'
            const { data: skuData } = await supabase
                .from('product_variants')
                .select('*')
                .eq('product_id', id)
                .eq('is_active', true);
            
            setSkus(skuData || []);
        }
        setLoadingStock(false);
    };

    fetchData();
  }, [id]);

  // --- LOGIC CHECK STOCK DIGITAL (RPC) ---
  const checkDigitalStock = async (prod, options) => {
      setLoadingStock(true);
      try {
          const validOptions = Object.keys(options).length > 0 ? options : {};
          const { data: count, error } = await supabase.rpc('get_digital_stock', {
              p_id: prod.id,
              v_info: validOptions
          });
          
          if (error) {
              console.error("Stock check error:", error);
              setCurrentStock(0);
          } else {
              setCurrentStock(count || 0);
          }
      } catch (err) {
          console.error(err);
          setCurrentStock(0);
      } finally {
          setLoadingStock(false);
      }
  };

  // --- REACTIVE UI: XỬ LÝ KHI THAY ĐỔI OPTION ---
  useEffect(() => {
      if (!product) return;
      
      // 1. Tìm biến thể (SKU) tương ứng trong list đã fetch
      let matchingSku = null;
      if (skus.length > 0) {
          matchingSku = skus.find(sku => {
              const skuOpts = sku.options; // Cột options trong DB là JSONB
              const selectedKeys = Object.keys(selectedOptions);
              // So sánh số lượng key và giá trị từng key
              if (Object.keys(skuOpts).length !== selectedKeys.length) return false;
              return selectedKeys.every(key => skuOpts[key] === selectedOptions[key]);
          });
      }

      // 2. Cập nhật Giá (Giá gốc + Price Mod từ SKU)
      const basePrice = product.price;
      const priceMod = matchingSku ? (parseFloat(matchingSku.price_mod) || 0) : 0;
      setFinalPrice(basePrice + priceMod);

      // 3. Cập nhật Hình ảnh (Ưu tiên ảnh của SKU nếu có)
      if (matchingSku && matchingSku.image) {
          setMainImg(matchingSku.image);
      }

      // 4. Cập nhật Tồn kho
      if (product.is_digital) {
          // Nếu là Digital: Gọi RPC check key
          checkDigitalStock(product, selectedOptions);
      } else {
          // Nếu là Vật lý: Lấy trực tiếp stock từ SKU hoặc Sản phẩm cha
          if (product.variants && product.variants.length > 0) {
              // Có biến thể -> Lấy stock của SKU tìm thấy
              setCurrentStock(matchingSku ? matchingSku.stock : 0);
          } else {
              // Không biến thể -> Lấy stock chung
              setCurrentStock(product.physical_stock || 0);
          }
      }

  }, [selectedOptions, product, skus]);

  // Handle click option (Chỉ update state, logic xử lý nằm ở useEffect trên)
  const handleOptionChange = (variantName, value) => {
      setSelectedOptions(prev => ({ ...prev, [variantName]: value }));
  };

  // Tạo object để thêm vào giỏ hàng
  const getProductToAdd = () => {
      // Tìm SKU ID nếu có
      let matchingSku = null;
      if(skus.length > 0) {
          matchingSku = skus.find(sku => JSON.stringify(sku.options) === JSON.stringify(selectedOptions));
      }

      return { 
        ...product, 
        price: finalPrice, // Giá đã tính toán
        selectedVariants: selectedOptions,
        variantId: matchingSku ? matchingSku.id : null, // Lưu thêm ID biến thể để dễ xử lý về sau
        image: mainImg, // Lưu ảnh hiện tại vào giỏ (để hiển thị đúng màu khách chọn)
        maxStock: currentStock 
      };
  };

  const isOutOfStock = !loadingStock && currentStock <= 0 && !product?.allow_external_key;

  const handleAddToCart = () => {
      if (loadingStock) return;
      if (isOutOfStock) return toast.error(t("Sản phẩm tạm hết hàng!", "Out of stock!"));
      
      const currentCartItem = cart.find(i => 
          i.id === product.id && JSON.stringify(i.selectedVariants) === JSON.stringify(selectedOptions)
      );
      const currentQty = currentCartItem ? currentCartItem.quantity : 0;
      
      if (!product.allow_external_key && (currentQty + 1 > currentStock)) {
          return toast.warn(t(`Kho chỉ còn ${currentStock} sản phẩm.`, `Only ${currentStock} left in stock.`));
      }

      if(product) { 
          addToCart(getProductToAdd()); 
          toast.success(t("Đã thêm vào giỏ hàng!", "Added to cart!")); 
      }
  }

  const handleBuyNow = () => {
      if (loadingStock) return;
      if (isOutOfStock) return toast.error(t("Sản phẩm tạm hết hàng!", "Out of stock!"));
      
      const currentCartItem = cart.find(i => 
          i.id === product.id && JSON.stringify(i.selectedVariants) === JSON.stringify(selectedOptions)
      );
      const currentQty = currentCartItem ? currentCartItem.quantity : 0;

      if (!product.allow_external_key && (currentQty + 1 > currentStock)) {
          return toast.warn(t("Không đủ hàng trong kho!", "Not enough stock!"));
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
        {/* LEFT COLUMN: IMAGES */}
        <div className="md:w-1/2 flex flex-col gap-4">
          <div className="h-80 md:h-96 bg-gray-50 rounded-2xl overflow-hidden border border-slate-100 flex items-center justify-center p-4 relative group">
            <img src={mainImg} alt={displayTitle} className="w-full h-full object-contain hover:scale-105 transition duration-500" />
          </div>
          {/* Thumbnails list: Includes Product Images AND Variant Images */}
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {/* Ảnh gốc của sản phẩm */}
              {product.images?.map((img, idx) => (
                <img key={`prod-${idx}`} src={img} onClick={() => setMainImg(img)} className={`w-20 h-20 object-cover rounded-xl cursor-pointer border-2 transition ${mainImg === img ? 'border-blue-600 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`} />
              ))}
              {/* Ảnh từ các biến thể (nếu có và khác ảnh gốc) */}
              {skus.filter(s => s.image).map((s, idx) => (
                 !product.images?.includes(s.image) && (
                    <img key={`sku-${idx}`} src={s.image} onClick={() => setMainImg(s.image)} className={`w-20 h-20 object-cover rounded-xl cursor-pointer border-2 transition ${mainImg === s.image ? 'border-blue-600 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`} title={s.sku_name}/>
                 )
              ))}
          </div>
        </div>

        {/* RIGHT COLUMN: INFO */}
        <div className="md:w-1/2 mt-8 md:mt-0 flex flex-col">
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 mb-4 leading-tight">{displayTitle}</h1>
          <div className="flex items-center gap-4 mb-6">
             <div className="text-3xl font-extrabold text-green-600">{finalPrice.toFixed(2)} USDT</div>
             {product.is_digital ? <span className="flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full uppercase"><Zap size={12}/> Digital Key</span> : <span className="flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full uppercase"><Box size={12}/> Physical</span>}
          </div>

          <div className={`mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold ${!isOutOfStock ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {loadingStock ? (
                  <span className="animate-pulse">Updating stock...</span>
              ) : !isOutOfStock ? (
                  <><CheckCircle size={16}/> {product.allow_external_key && currentStock <=0 ? t('Sẵn hàng', 'In Stock') : `${t('Sẵn hàng', 'In Stock')}: ${currentStock}`}</>
              ) : (
                  <><AlertTriangle size={16}/> {t('Hết hàng', 'Out of Stock')}</>
              )}
          </div>

          {/* VARIANT SELECTORS */}
          {product.variants && product.variants.length > 0 && (
              <div className="mb-6 space-y-4 p-5 bg-slate-50 rounded-xl border border-slate-100">
                  {product.variants.map((variant, idx) => (
                      <div key={idx}>
                          <p className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1"><Tag size={14}/> {variant.name}</p>
                          <div className="flex flex-wrap gap-2">
                              {variant.options.map((opt, optIdx) => {
                                  const displayLabel = lang === 'vi' ? opt.label : (opt.label_en || opt.label);
                                  const isSelected = selectedOptions[variant.name] === opt.label; 
                                  
                                  // Kiểm tra xem option này có làm thay đổi giá không? (Chỉ mang tính chất gợi ý, vì giá thực nằm ở tổ hợp cuối)
                                  // Tuy nhiên để đơn giản UI, ta không hiển thị +$ ở đây nữa vì giá nhảy ở trên rồi.
                                  
                                  return (
                                      <button key={optIdx} onClick={() => handleOptionChange(variant.name, opt.label)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'}`}>
                                          {displayLabel}
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
