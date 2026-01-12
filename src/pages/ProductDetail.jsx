import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useCart } from '../context/CartContext';
import { useLang } from '../context/LangContext';
import { ShoppingCart, Check, AlertCircle, Package } from 'lucide-react';
import { toast } from 'react-toastify';

export default function ProductDetail() {
  const { t, lang } = useLang();
  const { id } = useParams();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // State quản lý lựa chọn của khách
  const [selectedVariantCode, setSelectedVariantCode] = useState(null);
  const [displayPrice, setDisplayPrice] = useState(0);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      // 1. Lấy thông tin sản phẩm
      const { data: prod, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;

      // 2. Lấy thông tin tồn kho (Dùng RPC hoặc View tùy hệ thống của bạn)
      // Ở đây giả định bạn dùng view product_stock hoặc bảng product_keys để group
      // Để đơn giản và chính xác nhất với dữ liệu bạn cung cấp, ta gọi RPC lấy stock
      const { data: stocks } = await supabase.rpc('get_product_stock', { p_product_id: id });
      
      // Gộp data
      const finalProduct = {
          ...prod,
          variant_stocks: stocks || [] // [{"stock": 1, "options": {"value": "50000"}}, ...]
      };
      
      setProduct(finalProduct);
      setDisplayPrice(finalProduct.price);

      // Tự động chọn biến thể đầu tiên nếu có
      const availableVariants = getDisplayVariants(finalProduct);
      if (availableVariants.length > 0) {
          handleSelectVariant(availableVariants[0], finalProduct);
      }

    } catch (err) {
      console.error(err);
      toast.error(t("Không tải được sản phẩm", "Could not load product"));
      navigate('/products');
    } finally {
      setLoading(false);
    }
  };

  // --- LOGIC QUAN TRỌNG: TỔNG HỢP BIẾN THỂ ---
  // Hàm này kết hợp variants_config (Admin cài) VÀ variant_stocks (Thực tế kho)
  const getDisplayVariants = (prod) => {
      if (!prod) return [];

      // TH1: Admin đã cấu hình variants_config (Ưu tiên dùng cái này)
      if (prod.variants_config && prod.variants_config.length > 0) {
          return prod.variants_config.map(cfg => {
              // Tìm tồn kho khớp với mã code
              // Logic khớp: Cột variant trong DB hoặc options.value (legacy)
              const stockData = prod.variant_stocks.find(s => 
                  s.variant === cfg.code || s.options?.value === cfg.code || s.options?.value === cfg.name
              );
              return {
                  ...cfg,
                  stock: stockData ? stockData.stock : 0
              };
          });
      }

      // TH2: Admin chưa cấu hình (variants_config rỗng) -> Quét từ variant_stocks
      // Dữ liệu bạn cung cấp: [{"stock": 1, "options": {"value": "50000"}}]
      if (prod.variant_stocks && prod.variant_stocks.length > 0) {
          return prod.variant_stocks.map(s => {
              const val = s.options?.value || s.variant || "Default";
              return {
                  name: val,          // Hiển thị tên là giá trị (50000)
                  code: val,          // Mã cũng là giá trị
                  price: prod.price,  // Giá lấy theo giá gốc sp
                  stock: s.stock
              };
          });
      }

      return [];
  };

  const handleSelectVariant = (variant, prod = product) => {
      setSelectedVariantCode(variant.code);
      // Nếu biến thể có giá riêng thì dùng, không thì dùng giá gốc
      setDisplayPrice(variant.price && variant.price > 0 ? variant.price : prod.price);
  };

  const handleAddToCart = () => {
    if (!product) return;
    
    const variants = getDisplayVariants(product);
    let itemToAdd = {
        id: product.id,
        title: product.title,
        price: displayPrice,
        image: product.images?.[0] || '',
        is_digital: product.is_digital
    };

    // Nếu sản phẩm có biến thể
    if (variants.length > 0) {
        if (!selectedVariantCode) {
            toast.warning(t("Vui lòng chọn phân loại!", "Please select a variant!"));
            return;
        }
        
        const selected = variants.find(v => v.code === selectedVariantCode);
        if (!selected) return;

        if (selected.stock <= 0) {
            toast.error(t("Sản phẩm này tạm hết hàng!", "Out of stock!"));
            return;
        }

        // Gắn thông tin biến thể vào item giỏ hàng
        itemToAdd = {
            ...itemToAdd,
            variant_name: selected.name, // Tên hiển thị (VD: 50k)
            variant_code: selected.code, // Mã SKU (VD: VTT50 hoặc 50000)
            price: selected.price > 0 ? selected.price : product.price
        };
    } else {
        // Sản phẩm không biến thể -> check tổng tồn kho (physical_stock hoặc count key)
        const totalStock = product.physical_stock || product.variant_stocks?.reduce((acc, s) => acc + s.stock, 0) || 0;
        if (totalStock <= 0) {
             toast.error(t("Sản phẩm này tạm hết hàng!", "Out of stock!"));
             return;
        }
    }

    addToCart(itemToAdd);
    toast.success(t("Đã thêm vào giỏ!", "Added to cart!"));
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  if (!product) return null;

  const variants = getDisplayVariants(product);
  const currentVariant = variants.find(v => v.code === selectedVariantCode);
  const currentStock = currentVariant ? currentVariant.stock : (product.physical_stock || 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* CỘT TRÁI: ẢNH */}
        <div className="space-y-4">
            <div className="aspect-square bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                <img 
                    src={product.images?.[0] || 'https://via.placeholder.com/500'} 
                    alt={product.title}
                    className="w-full h-full object-contain hover:scale-105 transition duration-500"
                />
            </div>
            {product.images?.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                    {product.images.map((img, idx) => (
                        <div key={idx} className="aspect-square border rounded-lg overflow-hidden cursor-pointer hover:border-blue-500">
                            <img src={img} className="w-full h-full object-cover"/>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* CỘT PHẢI: THÔNG TIN */}
        <div className="space-y-8">
            <div>
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block">
                    {product.category || 'Product'}
                </span>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">{product.title}</h1>
                <div className="flex items-center gap-4">
                     <span className="text-2xl font-bold text-blue-600">
                        {displayPrice.toLocaleString('vi-VN')} đ
                     </span>
                     {product.is_digital && (
                         <span className="flex items-center gap-1 text-green-600 text-sm font-medium bg-green-50 px-2 py-1 rounded">
                             <Check size={14}/> {t("Giao hàng tự động", "Auto Delivery")}
                         </span>
                     )}
                </div>
            </div>

            <div className="prose text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p>{product.description || t("Chưa có mô tả.", "No description available.")}</p>
            </div>

            {/* PHẦN CHỌN BIẾN THỂ (VARIANTS) */}
            {variants.length > 0 && (
                <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                        {t("Chọn phân loại:", "Select Option:")}
                    </label>
                    <div className="flex flex-wrap gap-3">
                        {variants.map((v, idx) => {
                            const isActive = selectedVariantCode === v.code;
                            const isOutOfStock = v.stock <= 0;
                            return (
                                <button
                                    key={idx}
                                    onClick={() => !isOutOfStock && handleSelectVariant(v)}
                                    disabled={isOutOfStock}
                                    className={`
                                        relative px-6 py-3 rounded-lg border-2 font-medium transition-all
                                        ${isActive 
                                            ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' 
                                            : 'border-slate-200 hover:border-blue-300 text-slate-600 bg-white'}
                                        ${isOutOfStock ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}
                                    `}
                                >
                                    {v.name}
                                    {v.price > 0 && v.price !== product.price && (
                                        <span className="block text-xs font-normal opacity-80">
                                            {v.price.toLocaleString()} đ
                                        </span>
                                    )}
                                    {/* Badge số lượng tồn */}
                                    {isOutOfStock ? (
                                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                            Sold Out
                                        </span>
                                    ) : (
                                        <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                            {v.stock}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TRẠNG THÁI KHO & NÚT MUA */}
            <div className="pt-6 border-t border-slate-100 space-y-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Package size={18}/>
                    {currentStock > 0 ? (
                        <span className="text-green-600 font-medium">
                            {t(`Còn hàng (${currentStock} sẵn có)`, `In Stock (${currentStock} available)`)}
                        </span>
                    ) : (
                        <span className="text-red-500 font-medium">{t("Hết hàng", "Out of Stock")}</span>
                    )}
                </div>

                <button 
                    onClick={handleAddToCart}
                    disabled={currentStock <= 0}
                    className={`
                        w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg
                        ${currentStock > 0 
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-blue-200 hover:scale-[1.02]' 
                            : 'bg-slate-300 text-slate-500 cursor-not-allowed'}
                    `}
                >
                    <ShoppingCart size={24}/>
                    {currentStock > 0 ? t("Thêm vào giỏ hàng", "Add to Cart") : t("Tạm hết hàng", "Out of Stock")}
                </button>
                
                <p className="text-center text-xs text-slate-400">
                    {t("Cam kết bảo mật & Giao hàng ngay lập tức", "Secure Payment & Instant Delivery")}
                </p>
            </div>
        </div>
      </div>
    </div>
  );
}
