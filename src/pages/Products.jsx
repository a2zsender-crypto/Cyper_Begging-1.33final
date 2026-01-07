import React, { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import { LangContext } from '../context/LangContext';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const { lang } = useContext(LangContext);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = category === 'all' 
    ? products 
    : products.filter(p => p.category === category);

  const formatPrice = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold mb-8 text-center">
        {lang === 'vi' ? 'Sản phẩm' : 'Our Products'}
      </h2>
      
      {/* Category Filter */}
      <div className="flex justify-center gap-4 mb-8">
        <button 
          onClick={() => setCategory('all')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            category === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All
        </button>
        <button 
          onClick={() => setCategory('account')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            category === 'account' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Accounts
        </button>
        <button 
          onClick={() => setCategory('software')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            category === 'software' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Software
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => {
             // Logic check stock fix: API products are always available usually, or check strict stock
             const isAvailable = product.type === 'key' || product.stock > 0;
             
             return (
              <div key={product.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
                <Link to={`/product/${product.id}`} className="block"> {/* FIX: Removed 's' from /products/ */}
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
                    
                    <p className="text-gray-600 mb-4 line-clamp-2 text-sm">{product.description}</p>
                    
                    <div className="flex justify-between items-center mt-auto">
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
    </div>
  );
};

export default Products;
