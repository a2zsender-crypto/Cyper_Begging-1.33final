import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useCart } from '../context/CartContext';
import { useLang } from '../context/LangContext';
import { FiShoppingCart, FiCheck, FiX, FiInfo } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { t, lang } = useLang();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [activeTab, setActiveTab] = useState('description');

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setProduct(data);
      
      if (data.variant_stocks && data.variant_stocks.length > 0) {
        setSelectedVariant(data.variant_stocks[0].options);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      toast.error(t('Không thể tải thông tin sản phẩm', 'Failed to load product'));
      navigate('/products');
    } finally {
      setLoading(false);
    }
  };

  // --- CHECK STOCK LOGIC (Quan trọng) ---
  const checkAvailability = (prod) => {
    if (!prod) return false;
    // 1. API Mode (Fix tên biến)
    if (prod.is_digital && prod.allow_external_key) return true;
    // 2. Fallback sang tồn kho tổng (Do Trigger SQL tính)
    return (prod.physical_stock > 0);
  };

  const getCurrentStockCount = () => {
      if (!product) return 0;
      if (product.is_digital && product.allow_external_key) return 9999;

      // Nếu có biến thể -> Lấy đúng stock của biến thể đó
      if (selectedVariant && product.variant_stocks) {
          const variantItem = product.variant_stocks.find(v => 
              JSON.stringify(v.options) === JSON.stringify(selectedVariant)
          );
          return variantItem ? variantItem.stock : 0;
      }
      return product.physical_stock;
  };

  const isBuyable = () => {
      if (!checkAvailability(product)) return false;
      if (product.is_digital && product.allow_external_key) return true;
      const currentStock = getCurrentStockCount();
      return currentStock > 0;
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (!isBuyable()) {
      toast.error(t('Sản phẩm tạm hết hàng', 'Out of Stock'));
      return;
    }
    addToCart(product, selectedVariant);
    toast.success(t('Đã thêm vào giỏ hàng!', 'Added to cart!'));
  };

  if (loading) return (
    <div className="min-h-screen pt-20 flex justify-center items-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  if (!product) return null;

  const buyable = isBuyable();
  const stockCount = getCurrentStockCount();
  const isApiMode = product.is_digital && product.allow_external_key;

  return (
    <div className="min-h-screen pt-20 pb-10 bg-gray-50">
      <div className="container mx-auto px-4">
        {/* Breadcrumb */}
        <div className="text-sm breadcrumbs mb-6 text-gray-500">
          <ul className="flex items-center space-x-2">
            <li><a href="/" className="hover:text-blue-600">{t('Trang chủ', 'Home')}</a></li>
            <li>/</li>
            <li><a href="/products" className="hover:text-blue-600">{t('Sản phẩm', 'Products')}</a></li>
            <li>/</li>
            <li className="text-gray-900 font-medium truncate max-w-[200px]">
                {lang === 'vi' ? product.title : (product.title_en || product.title)}
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 lg:p-8">
            {/* Images */}
            <div className="space-y-4">
              <div className="aspect-video w-full bg-gray-100 rounded-xl overflow-hidden border border-gray-200 relative group">
                <img 
                  src={product.images?.[0] || 'https://via.placeholder.com/800x450?text=No+Image'} 
                  alt={product.title}
                  className="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                />
                {!buyable && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="bg-red-500 text-white px-6 py-2 rounded-full font-bold transform -rotate-12 border-2 border-white shadow-lg">
                      {t('HẾT HÀNG', 'OUT OF STOCK')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    product.is_digital ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {product.is_digital ? 'Digital Product' : 'Physical Product'}
                  </span>
                  
                  <div className="flex items-center text-sm text-gray-500">
                      <span className={`flex items-center ${buyable ? 'text-green-600' : 'text-red-500'}`}>
                        {buyable ? (
                          <>
                            <FiCheck className="mr-1" /> 
                            {isApiMode ? 'Auto API' : `${t('Còn hàng', 'In Stock')}: ${stockCount}`}
                          </>
                        ) : (
                          <><FiX className="mr-1" /> {t('Hết hàng', 'Out of Stock')}</>
                        )}
                      </span>
                  </div>
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-2 leading-tight">
                    {lang === 'vi' ? product.title : (product.title_en || product.title)}
                </h1>
                <div className="text-2xl font-bold text-blue-600 font-mono">
                  {product.price} USDT
                </div>
              </div>

              {/* Variants */}
              {product.variant_stocks && product.variant_stocks.length > 0 && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700">{t('Chọn loại:', 'Select Option:')}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {product.variant_stocks.map((v, idx) => {
                       const label = Object.values(v.options).join(' / ');
                       const isSelected = JSON.stringify(selectedVariant) === JSON.stringify(v.options);
                       const hasStock = isApiMode ? true : (v.stock > 0);

                       return (
                          <button
                            key={idx}
                            onClick={() => setSelectedVariant(v.options)}
                            className={`relative p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                                : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                            } ${!hasStock && !isSelected ? 'opacity-50 grayscale' : ''}`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-gray-900">{label}</span>
                              {isSelected && <FiCheck className="text-blue-500" />}
                            </div>
                            <div className={`text-xs mt-1 ${hasStock ? 'text-green-600' : 'text-red-500'}`}>
                               {isApiMode ? 'Auto' : `Stock: ${v.stock}`}
                            </div>
                          </button>
                       );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 border-t border-gray-100">
                <button
                  onClick={handleAddToCart}
                  disabled={!buyable}
                  className={`w-full py-4 px-6 rounded-xl font-bold text-lg flex items-center justify-center space-x-2 transition-all duration-200 ${
                    !buyable
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5'
                  }`}
                >
                  <FiShoppingCart className="w-6 h-6" />
                  <span>{buyable ? t('Thêm vào giỏ hàng', 'Add to Cart') : t('Tạm hết hàng', 'Out of Stock')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Details & Guide Tab */}
          <div className="border-t border-gray-200">
            <div className="flex border-b border-gray-200">
              <button onClick={() => setActiveTab('description')} className={`flex-1 py-4 text-sm font-medium relative ${activeTab === 'description' ? 'text-blue-600' : 'text-gray-500'}`}>
                {t('Mô tả chi tiết', 'Description')}
                {activeTab === 'description' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>}
              </button>
              <button onClick={() => setActiveTab('guide')} className={`flex-1 py-4 text-sm font-medium relative ${activeTab === 'guide' ? 'text-blue-600' : 'text-gray-500'}`}>
                {t('Hướng dẫn sử dụng', 'User Guide')}
                {activeTab === 'guide' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>}
              </button>
            </div>
            
            <div className="p-6 lg:p-8 bg-gray-50/50 min-h-[300px]">
              {activeTab === 'description' ? (
                <div className="prose max-w-none text-gray-600 whitespace-pre-line">
                  {lang === 'vi' ? product.description : (product.description_en || product.description)}
                </div>
              ) : (
                <div className="prose max-w-none text-gray-600">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
                    <h4 className="flex items-center text-blue-800 font-bold mb-2"><FiInfo className="mr-2" /> {t('Lưu ý quan trọng', 'Important Note')}</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>{t('Vui lòng đọc kỹ hướng dẫn trước khi sử dụng.', 'Read instructions carefully.')}</li>
                      <li>{t('Liên hệ hỗ trợ nếu gặp bất kỳ vấn đề gì.', 'Contact support if you have issues.')}</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
