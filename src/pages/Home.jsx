import React, { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import { LangContext } from '../context/LangContext';

const Home = () => {
  const [latestProducts, setLatestProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { lang } = useContext(LangContext);

  useEffect(() => {
    fetchLatestProducts();
  }, []);

  const fetchLatestProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;
      setLatestProducts(data);
    } catch (error) {
      console.error('Error fetching latest products:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="space-y-12 py-8">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-16 rounded-3xl mx-4 shadow-xl">
        <div className="container mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            {lang === 'vi' ? 'Giải Pháp Số Tự Động' : 'Digital Automation Solutions'}
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-blue-100">
            {lang === 'vi' 
              ? 'Cung cấp tài khoản, phần mềm và key bản quyền chất lượng cao' 
              : 'Premium accounts, software, and license keys instantly delivered'}
          </p>
          <Link 
            to="/products" 
            className="inline-block bg-white text-blue-600 font-bold py-3 px-8 rounded-full hover:bg-blue-50 transition-colors duration-300 shadow-lg"
          >
            {lang === 'vi' ? 'Xem Sản Phẩm' : 'Browse Products'}
          </Link>
        </div>
      </section>

      {/* Latest Products */}
      <section className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800">
            {lang === 'vi' ? 'Sản Phẩm Mới Nhất' : 'Latest Products'}
          </h2>
          <Link to="/products" className="text-blue-600 hover:text-blue-800 font-medium">
            {lang === 'vi' ? 'Xem tất cả →' : 'View All →'}
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {latestProducts.map((product) => {
              // FIX: Stock Logic for API/Key products
              const isAvailable = product.stock > 0 || product.type === 'key' || product.api_type === 'yes';

              return (
                <div key={product.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
                  <Link to={`/product/${product.id}`} className="block">
                    <div className="relative aspect-video">
                      <img 
                        src={product.image_url || 'https://via.placeholder.com/400x225?text=No+Image'} 
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                      {!isAvailable && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-white font-bold text-lg">Out of Stock</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-bold text-gray-800 line-clamp-1">{product.name}</h3>
                        <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                          {product.category}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center mt-4">
                        <span className="text-2xl font-bold text-blue-600">
                          {formatPrice(product.price)}
                        </span>
                        <span className={`text-sm font-medium ${isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                          {isAvailable 
                            ? (lang === 'vi' ? 'Sẵn hàng' : 'In Stock') 
                            : (lang === 'vi' ? 'Hết hàng' : 'Out of Stock')}
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Features Section */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="p-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">{lang === 'vi' ? 'Giao Hàng Tức Thì' : 'Instant Delivery'}</h3>
              <p className="text-gray-600">
                {lang === 'vi' 
                  ? 'Nhận sản phẩm tự động qua email ngay sau khi thanh toán thành công.'
                  : 'Receive your products automatically via email immediately after successful payment.'}
              </p>
            </div>
            <div className="p-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">{lang === 'vi' ? 'Bảo Hành Uy Tín' : 'Warranty Guaranteed'}</h3>
              <p className="text-gray-600">
                {lang === 'vi'
                  ? 'Cam kết bảo hành đầy đủ cho mọi sản phẩm. Hỗ trợ kỹ thuật 24/7.'
                  : 'Full warranty commitment for all products. 24/7 technical support.'}
              </p>
            </div>
            <div className="p-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">{lang === 'vi' ? 'Thanh Toán An Toàn' : 'Secure Payment'}</h3>
              <p className="text-gray-600">
                {lang === 'vi'
                  ? 'Hỗ trợ nhiều phương thức thanh toán an toàn, bảo mật thông tin tuyệt đối.'
                  : 'Support multiple secure payment methods, absolute information security.'}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
