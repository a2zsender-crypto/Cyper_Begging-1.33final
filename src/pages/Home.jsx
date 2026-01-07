import React, { useEffect, useState, useContext } from 'react';
import { supabase } from '../supabaseClient';
import Layout from '../components/Layout';
import { Link } from 'react-router-dom';
import { CartContext } from '../context/CartContext';
import { FaShoppingCart, FaSearch, FaArrowRight } from 'react-icons/fa';

const Home = () => {
  const [latestProducts, setLatestProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useContext(CartContext);

  useEffect(() => {
    fetchLatestProducts();
  }, []);

  const fetchLatestProducts = async () => {
    try {
      setLoading(true);
      // LẤY THÊM product_variants VÀ product_keys ĐỂ TÍNH TỒN KHO CHÍNH XÁC
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_variants(*),
          product_keys(id, is_used)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;
      setLatestProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // HÀM TÍNH TOÁN TỒN KHO CHUẨN (LOGIC FIX)
  const checkStockStatus = (product) => {
    // 1. Nếu bật Get Key via API -> Luôn In Stock
    if (product.check_stock_api) return true;

    // 2. Nếu có biến thể -> Tổng tồn kho các biến thể
    if (product.has_variants && product.product_variants?.length > 0) {
      const totalVariantStock = product.product_variants.reduce(
        (acc, variant) => acc + (variant.stock_quantity || 0), 
        0
      );
      return totalVariantStock > 0;
    }

    // 3. Nếu là Digital (không biến thể) -> Đếm key chưa dùng
    if (product.is_digital) {
      const availableKeys = product.product_keys 
        ? product.product_keys.filter(k => !k.is_used).length 
        : 0;
      return availableKeys > 0;
    }

    // 4. Sản phẩm vật lý thường -> Dùng physical_stock
    return (product.physical_stock || 0) > 0;
  };

  return (
    <Layout>
      {/* Hero Section - Giữ nguyên nếu có */}
      <div className="bg-gray-900 text-white py-20 px-4 text-center">
        <h1 className="text-5xl font-bold mb-4">Welcome to Auto Shop Pro</h1>
        <p className="text-xl text-gray-400 mb-8">Premium Digital Products & Keys Delivered Instantly</p>
        <Link to="/products" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-medium transition duration-300">
          Shop Now
        </Link>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Latest Products</h2>
            <p className="text-gray-500 mt-2">Newest additions to our store</p>
          </div>
          <Link to="/products" className="text-blue-600 hover:text-blue-800 flex items-center gap-2 font-medium">
            View All <FaArrowRight />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {latestProducts.map((product) => {
              const inStock = checkStockStatus(product);

              return (
                <div key={product.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 group">
                  <Link to={`/products/${product.id}`} className="block relative h-64 overflow-hidden">
                    <img
                      src={product.image_url || 'https://placehold.co/600x400?text=No+Image'}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    
                    {/* Overlay Out of Stock - CHỈ HIỆN KHI HẾT HÀNG THẬT */}
                    {!inStock && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="bg-red-500 text-white px-4 py-1 rounded-full font-bold text-sm transform -rotate-12">
                          OUT OF STOCK
                        </span>
                      </div>
                    )}

                    {product.is_digital && inStock && (
                      <div className="absolute top-3 right-3 bg-green-500/90 backdrop-blur-sm text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                        <i className="fas fa-bolt"></i> Instant
                      </div>
                    )}
                  </Link>

                  <div className="p-5">
                    <Link to={`/products/${product.id}`}>
                      <h3 className="text-lg font-bold text-gray-800 mb-2 line-clamp-1 group-hover:text-blue-600 transition-colors">
                        {product.name}
                      </h3>
                    </Link>
                    <div className="flex justify-between items-center mt-4">
                      <span className="text-xl font-bold text-blue-600">
                        ${product.price}
                      </span>
                      <button
                        onClick={() => inStock && addToCart(product)}
                        disabled={!inStock}
                        className={`p-3 rounded-full transition-colors duration-300 flex items-center justify-center ${
                          inStock
                            ? 'bg-gray-100 text-gray-800 hover:bg-blue-600 hover:text-white'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                        title={inStock ? "Add to Cart" : "Out of Stock"}
                      >
                        <FaShoppingCart />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Home;
