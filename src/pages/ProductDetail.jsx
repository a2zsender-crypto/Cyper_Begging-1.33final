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
  const [skus, setSkus] = useState([]); 
  const [mainImg, setMainImg] = useState('');
  
  const [selectedOptions, setSelectedOptions] = useState({});
  const [finalPrice, setFinalPrice] = useState(0);
  const [currentStock, setCurrentStock] = useState(0); 
  const [loadingStock, setLoadingStock] = useState(true);

  // --- FETCH DATA ---
  useEffect(() => {
    const fetchData = async () => {
        setLoadingStock(true);
        const { data: prodData } = await supabase.from('products').select('*').eq('id', id).single();
        
        if (prodData) {
            setProduct(prodData);
            if (prodData.images?.length) setMainImg(prodData.images[0]);
            setFinalPrice(prodData.price);
            
            // Set Default Options
            if (prodData.variants && Array.isArray(prodData.variants)) {
                const defaults = {};
                prodData.variants.forEach(v => {
                    if (v.options && v.options.length > 0) {
                        defaults[v.name] = v.options[0].label;
                    }
                });
                setSelectedOptions(defaults);
            }

            // Get Physical Variants info if any
            const { data: skuData } = await supabase.from('product_variants').select('*').eq('product_id', id).eq('is_active', true);
            setSkus(skuData || []);
        }
        setLoadingStock(false);
    };
    fetchData();
  }, [id]);

  // --- [LOGIC MỚI] CHECK STOCK REAL-TIME ---
  const checkStockRealTime = async (prod, options) => {
      setLoadingStock(true);
      try {
          if (prod.is_digital) {
              // Gọi RPC mới check_digital_stock
              const { data: count } = await supabase.rpc('check_digital_stock', {
                  p_id: prod.id,
                  v_info: options
              });
              setCurrentStock(count || 0);
          } else {
              // Hàng vật lý: Tìm trong mảng skus
              let stock = prod.physical_stock || 0;
              if (skus.length > 0) {
                  const match = skus.find(s => JSON.stringify(s.options) === JSON.stringify(options));
                  if (match) stock = match.stock;
              }
              setCurrentStock(stock);
          }
      } catch (err) {
          console.error(err);
          setCurrentStock(0);
      } finally {
          setLoadingStock(false);
      }
  };

  // --- REACTIVE UPDATES ---
  useEffect(() => {
      if (!product) return;
      
      // Update Price based on Variant Modifiers
      let priceMod = 0;
      // Tìm SKU vật lý nếu khớp để lấy giá mod
      const matchingSku = skus.find(sku => {
          const skuOpts = sku.options;
          const selectedKeys = Object.keys(selectedOptions);
          if (Object.keys(skuOpts).length !== selectedKeys.length) return false;
          return selectedKeys.every(key => skuOpts[key] === selectedOptions[key]);
      });
      if (matchingSku) priceMod = parseFloat(matchingSku.price_mod) || 0;
      
      setFinalPrice(product.price + priceMod);
      if (matchingSku && matchingSku.image) setMainImg(matchingSku.image);

      // Trigger check stock
      checkStockRealTime(product, selectedOptions);

  }, [selectedOptions, product, skus]);

  // --- HANDLERS ---
  const handleOptionChange = (variantName, value) => {
      setSelectedOptions(prev => ({ ...prev, [variantName]: value }));
  };

  const handleThumbnailClick = (img, skuOptions) => {
      setMainImg(img);
      if (skuOptions) setSelectedOptions(skuOptions);
  };

  const getProductToAdd = () => {
      return { 
        ...product, 
        price: finalPrice, 
        selectedVariants: selectedOptions, // QUAN TRỌNG: Gửi options đi
        image: mainImg, 
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
          return toast.warn(t(`Kho chỉ còn ${currentStock} sản phẩm.`, `Only ${currentStock} left.`));
      }
      addToCart(getProductToAdd()); 
      toast.success(t("Đã thêm vào giỏ hàng!", "Added to cart!")); 
  }

  const handleBuyNow = () => {
      if (loadingStock) return;
      if (isOutOfStock) return toast.error(t("Sản phẩm tạm hết hàng!", "Out of stock!"));
      addToCart(getProductToAdd()); 
      navigate('/cart'); 
  }

  if (!product) return <div className="flex justify-center items-center h-64 text-slate-400">Loading...</div>;

  const displayTitle = lang === 'vi' ? product.title : (product.title_en || product.title);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 md:flex gap-10">
        {/* LEFT: IMAGES */}
        <div className="md:w-1/2 flex flex-col gap-4">
          <div className="h-80 md:h-96 bg-gray-50 rounded-2xl overflow-hidden border border-slate-100 flex items-center justify-center p-4 relative">
            <img src={mainImg} alt={displayTitle} className="w-full h-full object-contain hover:scale-105 transition duration-500" />
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {product.images?.map((img, idx) => (
                <img key={`prod-${idx}`} src={img} onClick={() => handleThumbnailClick(img, null)} className={`w-20 h-20 object-cover rounded-xl cursor-pointer border-2 transition ${mainImg === img ? 'border-blue-600' : 'border-transparent opacity-60'}`} />
              ))}
              {skus.filter(s => s.image).map((s, idx) => (
                 !product.images?.includes(s.image) && (
                    <img key={`sku-${idx}`} src={s.image} onClick={() => handleThumbnailClick(s.image, s.options)} className="w-20 h-20 object-cover rounded-xl cursor-pointer border-2 border-transparent opacity-60 hover:opacity-100" />
                 )
              ))}
          </div>
        </div>

        {/* RIGHT: INFO */}
        <div className="md:w-1/2 mt-8 md:mt-0 flex flex-col">
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 mb-4">{displayTitle}</h1>
          <div className="flex items-center gap-4 mb-6">
             <div className="text-3xl font-extrabold text-green-600">{finalPrice.toFixed(2)} USDT</div>
             {product.is_digital ? <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">DIGITAL KEY</span> : <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">PHYSICAL</span>}
          </div>

          {/* STOCK BADGE */}
          <div className={`mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold ${!isOutOfStock ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {loadingStock ? <span>Checking...</span> : !isOutOfStock ? <><CheckCircle size={16}/> In Stock: {currentStock}</> : <><AlertTriangle size={16}/> Out of Stock</>}
          </div>

          {/* VARIANTS SELECTOR */}
          {product.variants && product.variants.length > 0 && (
              <div className="mb-6 space-y-4 p-5 bg-slate-50 rounded-xl border border-slate-100">
                  {product.variants.map((variant, idx) => (
                      <div key={idx}>
                          <p className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1"><Tag size={14}/> {variant.name}</p>
                          <div className="flex flex-wrap gap-2">
                              {variant.options.map((opt, optIdx) => {
                                  const label = lang === 'vi' ? opt.label : (opt.label_en || opt.label);
                                  const isSelected = selectedOptions[variant.name] === opt.label; 
                                  return (
                                      <button key={optIdx} onClick={() => handleOptionChange(variant.name, opt.label)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                                          {label}
                                      </button>
                                  )
                              })}
                          </div>
                      </div>
                  ))}
              </div>
          )}
          
          <div className="flex gap-4 mt-auto">
              <button onClick={handleAddToCart} disabled={isOutOfStock} className="flex-1 bg-white border-2 border-blue-600 text-blue-600 py-3.5 rounded-xl font-bold disabled:opacity-50">
                <ShoppingCart size={20} className="inline mr-2"/> {t('THÊM GIỎ HÀNG', 'ADD TO CART')}
              </button>
              <button onClick={handleBuyNow} disabled={isOutOfStock} className="flex-1 bg-red-600 text-white py-3.5 rounded-xl font-bold hover:bg-red-700 disabled:bg-gray-400">
                <CreditCard size={20} className="inline mr-2"/> {t('MUA NGAY', 'BUY NOW')}
              </button>
          </div>
        </div>
      </div>
    </div>
  );
}