import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { FiShoppingCart, FiArrowRight, FiCheck, FiX } from 'react-icons/fi';
import { useCart } from '../context/CartContext';
import toast from 'react-hot-toast';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

  useEffect(() => {
    fetchLatestProducts();
  }, []);

  const fetchLatestProducts = async () => {
    try {
      // Lấy products và sắp xếp mới nhất
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  // Hàm kiểm tra còn hàng hay không để hiển thị UI
  const checkAvailability = (product) => {
    // 1. Nếu là API -> Luôn có hàng
    if (product.get_key_api) return true;
    // 2. Nếu không -> Check tồn kho vật lý (đã được SQL sync)
    return (product.physical_stock > 0);
  };

  const handleAddToCart = (e, product) => {
    e.preventDefault(); // Ngăn chặn chuyển hướng thẻ Link
    if (!checkAvailability(product)) {
      toast.error('Sản phẩm tạm hết hàng');
      return;
    }
    // Mặc định chọn variant đầu tiên nếu có
    const defaultVariant = product.variant_stocks && product.variant_stocks.length > 0
      ? product.variant_stocks[0].options
      : null;
      
    addToCart(product, defaultVariant);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section - Giữ nguyên */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Giải Pháp Bản Quyền Số Tự Động
          </h1>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Cung cấp key bản quyền, tài khoản Premium và giải pháp phần mềm chất lượng cao. 
            Nhận hàng ngay lập tức qua Email.
          </p>
          <Link 
            to="/products" 
            className="inline-flex items-center bg-white text-blue-700 px-8 py-3 rounded-full font-bold hover:bg-blue-50 transition-colors shadow-lg"
          >
            Xem Tất Cả Sản Phẩm
            <FiArrowRight className="ml-2" />
          </Link>
        </div>
      </div>

      {/* Latest Products Section */}
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Sản Phẩm Mới Nhất</h2>
        
        {loading ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => {
              const isAvailable = checkAvailability(product);
              
              return (
                <Link 
                  to={`/products/${product.id}`} 
                  key={product.id}
                  className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden group flex flex-col h-full"
                >
                  <div className="aspect-video bg-gray-100 relative overflow-hidden">
                    <img 
                      src={product.image_url || 'https://via.placeholder.com/400x225?text=No+Image'} 
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    
                    {/* Badge Tình trạng kho */}
                    <div className="absolute top-2 right-2">
                      {isAvailable ? (
                        <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center shadow-sm">
                          <FiCheck className="mr-1" />
                          {product.get_key_api ? 'Auto API' : 'Sẵn hàng'}
                        </span>
                      ) : (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center shadow-sm">
                          <FiX className="mr-1" />
                          Hết hàng
                        </span>
                      )}
                    </div>

                    {/* Badge Category */}
                    <div className="absolute top-2 left-2">
                      <span className="bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
                        {product.category === 'software' ? 'Phần mềm' : 
                         product.category === 'account' ? 'Tài khoản' : 'Vật lý'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 flex flex-col flex-grow">
                    <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 min-h-[3rem]">
                      {product.name}
                    </h3>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-blue-600 font-bold text-lg">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}
                      </span>
                      <button 
                        onClick={(e) => handleAddToCart(e, product)}
                        disabled={!isAvailable}
                        className={`p-2 rounded-lg transition-colors ${
                          isAvailable 
                            ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' 
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                        title={isAvailable ? "Thêm vào giỏ" : "Hết hàng"}
                      >
                        <FiShoppingCart className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        
        <div className="text-center mt-12">
          <Link to="/products" className="text-blue-600 font-medium hover:text-blue-700 hover:underline">
            Xem thêm sản phẩm &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
