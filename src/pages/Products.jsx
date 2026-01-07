import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { ShoppingCart, Search, Filter } from 'lucide-react';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // all, digital, physical
  const { addToCart } = useCart();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      // Lấy thêm variants và variant_stocks để tính tồn kho chính xác
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- HÀM TÍNH TỒN KHO CHUẨN XÁC ---
  const calculateStock = (product) => {
    // 1. Nếu cho phép lấy key qua API -> Luôn coi là còn hàng
    if (product.allow_external_key) return 999;

    // 2. Nếu là sản phẩm vật lý -> Dùng kho vật lý
    if (!product.is_digital) {
      return product.physical_stock || 0;
    }

    // 3. Nếu là sản phẩm số (Digital Key)
    // Ưu tiên 1: Cộng tổng tồn kho của các biến thể (nếu có)
    if (product.variant_stocks && Array.isArray(product.variant_stocks) && product.variant_stocks.length > 0) {
      return product.variant_stocks.reduce((total, v) => total + (Number(v.stock) || 0), 0);
    }

    // Ưu tiên 2: Nếu không có biến thể, check kho vật lý (hoặc logic đếm key cũ nếu bạn dùng)
    return product.physical_stock || 0;
  };

  // Lọc sản phẩm
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' 
      ? true 
      : filter === 'digital' 
        ? product.is_digital 
        : !product.is_digital;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Sản Phẩm</h1>
        
        <div className="flex w-full md:w-auto gap-4">
          <div className="relative flex-grow md:flex-grow-0">
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 w-full"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
          
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-4 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="all">Tất cả</option>
            <option value="digital">Sản phẩm số</option>
            <option value="physical">Sản phẩm vật lý</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => {
            const stock = calculateStock(product); // Tính tồn kho
            const isOutOfStock = stock <= 0;
            const hasVariants = product.variants && product.variants.length > 0;

            return (
              <div key={product.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col h-full border border-gray-100">
                <Link to={`/products/${product.id}`} className="block relative aspect-video overflow-hidden bg-gray-100">
                   <img
                    src={product.images?.[0] || 'https://via.placeholder.com/300x200?text=No+Image'}
                    alt={product.title}
                    className="object-cover w-full h-full hover:scale-105 transition-transform duration-300"
                  />
                  {/* Badge Hết hàng */}
                  {isOutOfStock && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wide">
                        Hết hàng
                      </span>
                    </div>
                  )}
                  {/* Badge API */}
                  {product.allow_external_key && (
                    <div className="absolute top-2 right-2">
                       <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs font-bold shadow-sm">
                        AUTO API
                      </span>
                    </div>
                  )}
                </Link>

                <div className="p-4 flex flex-col flex-grow">
                  <Link to={`/products/${product.id}`} className="hover:text-blue-600 transition-colors">
                    <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 mb-2 min-h-[3.5rem]">
                      {product.title}
                    </h3>
                  </Link>
                  
                  <div className="mt-auto pt-4 flex items-center justify-between">
                    <div>
                      <span className="text-xl font-bold text-blue-600">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}
                      </span>
                      {/* Hiển thị tồn kho nhỏ */}
                      {!product.allow_external_key && (
                         <p className={`text-xs mt-1 ${isOutOfStock ? 'text-red-500' : 'text-green-600'}`}>
                           {isOutOfStock ? 'Tạm hết hàng' : `Còn lại: ${stock}`}
                         </p>
                      )}
                    </div>

                    {/* Nút Mua hàng */}
                    {hasVariants ? (
                      // Nếu có biến thể -> Bắt buộc vào trang chi tiết để chọn
                      <Link
                        to={`/products/${product.id}`}
                        className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-blue-600 transition-colors"
                        title="Chọn phân loại"
                      >
                        <Filter className="w-5 h-5" />
                      </Link>
                    ) : (
                      // Nếu không có biến thể -> Mua ngay được (trừ khi hết hàng)
                      <button
                        onClick={() => addToCart(product)}
                        disabled={isOutOfStock}
                        className={`p-2 rounded-full transition-colors ${
                          isOutOfStock
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                        }`}
                        title={isOutOfStock ? "Hết hàng" : "Thêm vào giỏ"}
                      >
                        <ShoppingCart className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Products;
