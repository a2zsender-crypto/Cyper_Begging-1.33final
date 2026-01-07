import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useCart } from '../context/CartContext';
import { FiShoppingCart, FiCheck, FiX, FiInfo, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [activeTab, setActiveTab] = useState('description');
  const [stockStatus, setStockStatus] = useState(null); // null: loading, 0: out, >0: in stock

  useEffect(() => {
    fetchProduct();
  }, [id]);

  // Kiểm tra stock mỗi khi chọn variant hoặc load xong product
  useEffect(() => {
    if (product) {
      checkRealtimeStock();
    }
  }, [product, selectedVariant]);

  const fetchProduct = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setProduct(data);
      
      // Mặc định chọn variant đầu tiên nếu có
      if (data.variant_stocks && data.variant_stocks.length > 0) {
        setSelectedVariant(data.variant_stocks[0].options);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      toast.error('Không thể tải thông tin sản phẩm');
      navigate('/products');
    } finally {
      setLoading(false);
    }
  };

  const checkRealtimeStock = async () => {
    if (!product) return;

    // 1. Nếu cho phép Get Key API -> Luôn có hàng
    if (product.get_key_api) {
      setStockStatus(999);
      return;
    }

    // 2. Nếu là sản phẩm vật lý -> Lấy từ cột physical_stock (đã được trigger cập nhật)
    if (!product.is_digital) {
       if (selectedVariant) {
          // Tìm stock của variant trong mảng variant_stocks của product
          const vStock = product.variant_stocks?.find(v => v.options.value === selectedVariant.value);
          setStockStatus(vStock ? vStock.stock : 0);
       } else {
          setStockStatus(product.physical_stock);
       }
       return;
    }

    // 3. Nếu là Digital -> Gọi RPC check stock an toàn
    try {
      const { data: count, error } = await supabase
        .rpc('get_available_stock', { 
           p_product_id: product.id,
           p_variant_name: selectedVariant ? selectedVariant.value : ''
        });

      if (error) {
        console.error('Error checking stock:', error);
        setStockStatus(0);
      } else {
        setStockStatus(count);
      }
    } catch (err) {
      setStockStatus(0);
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    
    // Check lại lần cuối ở Client (dù CartContext sẽ check lại)
    if (stockStatus === 0) {
      toast.error('Sản phẩm tạm hết hàng');
      return;
    }

    addToCart(product, selectedVariant);
  };

  if (loading) return (
    <div className="min-h-screen pt-20 flex justify-center items-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  if (!product) return null;

  const isOutOfStock = stockStatus === 0;

  // Format giá tiền
  const displayPrice = selectedVariant 
    ? selectedVariant.value 
    : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price);

  return (
    <div className="min-h-screen pt-20 pb-10 bg-gray-50">
      <div className="container mx-auto px-4">
        {/* Breadcrumb */}
        <div className="text-sm breadcrumbs mb-6 text-gray-500">
          <ul className="flex items-center space-x-2">
            <li><a href="/" className="hover:text-blue-600">Trang chủ</a></li>
            <li>/</li>
            <li><a href="/products" className="hover:text-blue-600">Sản phẩm</a></li>
            <li>/</li>
            <li className="text-gray-900 font-medium truncate max-w-[200px]">{product.name}</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 lg:p-8">
            {/* Left: Images */}
            <div className="space-y-4">
              <div className="aspect-video w-full bg-gray-100 rounded-xl overflow-hidden border border-gray-200 relative group">
                <img 
                  src={product.image_url || 'https://via.placeholder.com/800x450?text=No+Image'} 
                  alt={product.name}
                  className="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                />
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="bg-red-500 text-white px-6 py-2 rounded-full font-bold transform -rotate-12 border-2 border-white shadow-lg">
                      HẾT HÀNG
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Info */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    product.category === 'software' ? 'bg-blue-100 text-blue-700' : 
                    product.category === 'account' ? 'bg-purple-100 text-purple-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {product.category === 'software' ? 'Phần mềm' : 
                     product.category === 'account' ? 'Tài khoản' : 'Vật lý'}
                  </span>
                  <div className="flex items-center text-sm text-gray-500">
                    {stockStatus !== null && (
                      <span className={`flex items-center ${stockStatus > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {stockStatus > 0 ? (
                          <><FiCheck className="mr-1" /> Còn hàng {product.get_key_api ? '(Auto API)' : `(${stockStatus})`}</>
                        ) : (
                          <><FiX className="mr-1" /> Hết hàng</>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2 leading-tight">{product.name}</h1>
                <div className="text-2xl font-bold text-blue-600 font-mono">
                  {displayPrice}
                </div>
              </div>

              {/* Variants Selection */}
              {product.variant_stocks && product.variant_stocks.length > 0 && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700">Chọn loại sản phẩm:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {product.variant_stocks.map((v, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedVariant(v.options)}
                        className={`relative p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                          selectedVariant?.value === v.options.value
                            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                            : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-900">{v.options.value}</span>
                          {selectedVariant?.value === v.options.value && (
                            <FiCheck className="text-blue-500" />
                          )}
                        </div>
                        {/* Hiển thị stock của từng variant */}
                        <div className="text-xs mt-1 text-gray-500">
                           {/* Lưu ý: v.stock ở đây là static data từ bảng products.
                             Realtime check sẽ update lại stockStatus state.
                           */}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Features / Short Desc */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <FiCheck className="text-green-500 mr-2 flex-shrink-0" />
                    Bảo hành trọn đời sản phẩm
                  </li>
                  <li className="flex items-center">
                    <FiCheck className="text-green-500 mr-2 flex-shrink-0" />
                    Hỗ trợ cài đặt qua UltraViewer/TeamView
                  </li>
                  <li className="flex items-center">
                    <FiCheck className="text-green-500 mr-2 flex-shrink-0" />
                    Giao hàng tự động qua Email 24/7
                  </li>
                </ul>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-gray-100">
                <button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  className={`w-full py-4 px-6 rounded-xl font-bold text-lg flex items-center justify-center space-x-2 transition-all duration-200 ${
                    isOutOfStock
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5'
                  }`}
                >
                  <FiShoppingCart className="w-6 h-6" />
                  <span>{isOutOfStock ? 'Tạm hết hàng' : 'Thêm vào giỏ hàng'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Tabs */}
          <div className="border-t border-gray-200">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('description')}
                className={`flex-1 py-4 text-sm font-medium text-center transition-colors relative ${
                  activeTab === 'description' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Mô tả chi tiết
                {activeTab === 'description' && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>
                )}
              </button>
              <button
                onClick={() => setActiveTab('guide')}
                className={`flex-1 py-4 text-sm font-medium text-center transition-colors relative ${
                  activeTab === 'guide' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Hướng dẫn sử dụng
                {activeTab === 'guide' && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>
                )}
              </button>
            </div>
            
            <div className="p-6 lg:p-8 bg-gray-50/50 min-h-[300px]">
              {activeTab === 'description' ? (
                <div className="prose max-w-none text-gray-600">
                  <p className="whitespace-pre-line">{product.description || 'Chưa có mô tả chi tiết cho sản phẩm này.'}</p>
                </div>
              ) : (
                <div className="prose max-w-none text-gray-600">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
                    <h4 className="flex items-center text-blue-800 font-bold mb-2">
                      <FiInfo className="mr-2" /> Lưu ý quan trọng
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>Vui lòng đọc kỹ hướng dẫn trước khi sử dụng.</li>
                      <li>Không chia sẻ key/tài khoản cho người khác để tránh bị khóa.</li>
                      <li>Liên hệ hỗ trợ nếu gặp bất kỳ vấn đề gì trong quá trình cài đặt.</li>
                    </ul>
                  </div>
                  <p>Sau khi thanh toán thành công, hệ thống sẽ tự động gửi thông tin sản phẩm và hướng dẫn chi tiết qua Email của bạn.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
