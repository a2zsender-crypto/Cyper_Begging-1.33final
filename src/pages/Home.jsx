import React, { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { CartContext } from '../context/CartContext';
import { FaShoppingCart, FaEye } from 'react-icons/fa';

const Home = () => {
  const [latestProducts, setLatestProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart, calculateStock } = useContext(CartContext);

  useEffect(() => {
    fetchLatestProducts();
  }, []);

  const fetchLatestProducts = async () => {
    try {
      setLoading(true);
      // Fetch products và cả variants nếu có (giả sử variants là json hoặc relation)
      // Nếu variants là table riêng, cú pháp select cần là: *, variants(*)
      const { data, error } = await supabase
        .from('products')
        .select('*, variants(*)') 
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;
      setLatestProducts(data || []);
    } catch (error) {
      console.error('Error fetching latest products:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper render Badge (Tái sử dụng logic calculateStock từ Context)
  const renderStockBadge = (product) => {
    const stock = calculateStock(product);
    const isAvailable = stock > 0;

    if (isAvailable) {
      return (
        <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full z-10 shadow-md">
          In Stock
        </span>
      );
    }
    return (
      <span className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full z-10 shadow-md">
        Out of Stock
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section - Giữ nguyên nếu có, ở đây tôi demo phần Products */}
      <div className="bg-blue-600 text-white py-20 text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to Auto Shop Pro</h1>
        <p className="text-xl">Your destination for Digital & Physical Goods</p>
      </div>

      {/* Latest Products Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Latest Products</h2>
        
        {loading ? (
          <div className="text-center py-10">Loading products...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {latestProducts.map((product) => {
               // Tính stock ngay tại đây để dùng cho nút Add to Cart
               const stock = calculateStock(product);
               const isOutOfStock = stock <= 0;

               return (
                <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col">
                  <div className="relative group">
                    <Link to={`/products/${product.id}`}>
                      <img 
                        src={product.image_url || 'https://via.placeholder.com/300'} 
                        alt={product.name} 
                        className="w-full h-48 object-cover object-center"
                      />
                    </Link>
                    
                    {/* Stock Badge */}
                    {renderStockBadge(product)}

                    {/* Quick Action Overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <Link 
                        to={`/products/${product.id}`}
                        className="p-2 bg-white rounded-full text-gray-800 hover:text-blue-600 mx-2"
                        title="View Details"
                      >
                        <FaEye size={20} />
                      </Link>
                      <button
                        onClick={() => addToCart(product)}
                        disabled={isOutOfStock}
                        className={`p-2 rounded-full mx-2 ${
                          isOutOfStock 
                            ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                            : 'bg-white text-gray-800 hover:text-green-600'
                        }`}
                        title={isOutOfStock ? "Out of Stock" : "Add to Cart"}
                      >
                        <FaShoppingCart size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="p-4 flex-grow flex flex-col justify-between">
                    <div>
                      <Link to={`/products/${product.id}`} className="hover:text-blue-600">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2 truncate">{product.name}</h3>
                      </Link>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-blue-600 font-bold text-lg">
                          ${product.price ? product.price.toLocaleString() : '0'}
                        </span>
                        {product.compare_at_price > product.price && (
                          <span className="text-gray-400 line-through text-sm">
                            ${product.compare_at_price.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        <div className="text-center mt-10">
          <Link to="/products" className="inline-block bg-gray-900 text-white px-8 py-3 rounded-md hover:bg-gray-800 transition">
            View All Products
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
