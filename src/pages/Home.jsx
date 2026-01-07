import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useCart } from '../context/CartContext';
import { ShoppingCart, ArrowRight, Star, Zap, Shield, Headset } from 'lucide-react';
import { useLang } from '../context/LangContext';

const Home = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();
  const { t } = useLang();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      // Lấy 8 sản phẩm mới nhất, sắp xếp theo ngày tạo giảm dần
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: <Zap className="w-6 h-6 text-yellow-500" />,
      title: t('instantDelivery'),
      description: t('instantDeliveryDesc')
    },
    {
      icon: <Shield className="w-6 h-6 text-green-500" />,
      title: t('securePayment'),
      description: t('securePaymentDesc')
    },
    {
      icon: <Headset className="w-6 h-6 text-blue-500" />,
      title: t('support247'),
      description: t('support247Desc')
    }
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
        <div className="relative px-8 py-16 md:py-24 text-center text-white">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
            {t('heroTitle')}
          </h1>
          <p className="text-lg md:text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            {t('heroSubtitle')}
          </p>
          <Link
            to="/products"
            className="inline-flex items-center px-8 py-4 bg-white text-blue-600 rounded-full font-bold text-lg hover:bg-blue-50 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            {t('shopNow')}
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="grid md:grid-cols-3 gap-8">
        {features.map((feature, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-gray-100 dark:border-gray-700">
            <div className="bg-gray-50 dark:bg-gray-700 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
              {feature.icon}
            </div>
            <h3 className="text-xl font-bold mb-2 dark:text-white">{feature.title}</h3>
            <p className="text-gray-600 dark:text-gray-300">{feature.description}</p>
          </div>
        ))}
      </section>

      {/* Latest Products Section */}
      <section>
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-bold dark:text-white">{t('latestProducts')}</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">{t('latestProductsDesc')}</p>
          </div>
          <Link to="/products" className="text-blue-600 hover:text-blue-700 font-medium flex items-center">
            {t('viewAll')} <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg animate-pulse">
                <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 rounded-xl mb-4" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => {
              // LOGIC TÍNH TOÁN STOCK CHÍNH XÁC
              const isAvailable = product.get_key_via_api === true || (product.physical_stock > 0);

              return (
                <div key={product.id} className="group bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
                  <Link to={`/products/${product.id}`} className="relative block aspect-[4/3] overflow-hidden">
                    <img
                      src={product.image_url || 'https://via.placeholder.com/400x300?text=No+Image'}
                      alt={product.name}
                      className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                    />
                    {/* Badge Stock */}
                    {!isAvailable && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                          {t('outOfStock')}
                        </span>
                      </div>
                    )}
                    {isAvailable && (
                      <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                        {t('inStock')}
                      </div>
                    )}
                  </Link>
                  
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-center space-x-1 mb-2">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">4.9 (128)</span>
                    </div>
                    
                    <Link to={`/products/${product.id}`} className="block mb-2">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2 hover:text-blue-600 transition-colors">
                        {product.name}
                      </h3>
                    </Link>
                    
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 flex-1">
                      {product.description}
                    </p>
                    
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
                      <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}
                      </span>
                      
                      <button
                        onClick={() => addToCart(product)}
                        disabled={!isAvailable}
                        className={`p-2 rounded-xl transition-colors ${
                          isAvailable
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-blue-600 hover:text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                        }`}
                        title={isAvailable ? t('addToCart') : t('outOfStock')}
                      >
                        <ShoppingCart className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
