import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { CartContext } from '../context/CartContext';
import { LangContext } from '../context/LangContext';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useContext(CartContext);
  const { lang } = useContext(LangContext);
  const [adding, setAdding] = useState(false);

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
    } catch (error) {
      console.error('Error fetching product:', error);
      navigate('/products'); // Redirect back to products if not found
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    setAdding(true);
    addToCart(product);
    setTimeout(() => setAdding(false), 500);
  };

  const handleBuyNow = () => {
    addToCart(product);
    navigate('/cart');
  };

  const formatPrice = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (loading) return <div className="text-center py-12">Loading...</div>;
  if (!product) return null;

  // FIX: Stock Logic - API type or stock > 0
  const isAvailable = product.stock > 0 || product.type === 'key' || product.api_type === 'yes';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
          {/* Image Section */}
          <div className="space-y-4">
            <div className="aspect-video rounded-xl overflow-hidden bg-gray-100">
              <img 
                src={product.image_url || 'https://via.placeholder.com/600x400?text=No+Image'} 
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Info Section */}
          <div className="flex flex-col">
            <div className="mb-6">
              <span className="bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded-full">
                {product.category}
              </span>
              <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-2">{product.name}</h1>
              <div className="flex items-center space-x-4">
                <span className="text-3xl font-bold text-blue-600">
                  {formatPrice(product.price)}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {isAvailable 
                    ? (lang === 'vi' ? 'Sẵn hàng' : 'In Stock') 
                    : (lang === 'vi' ? 'Hết hàng' : 'Out of Stock')}
                </span>
              </div>
            </div>

            <div className="prose max-w-none text-gray-600 mb-8 flex-grow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {lang === 'vi' ? 'Mô tả sản phẩm' : 'Description'}
              </h3>
              <p className="whitespace-pre-line">{product.description}</p>
            </div>

            <div className="flex gap-4 mt-auto">
              <button
                onClick={handleAddToCart}
                disabled={!isAvailable}
                className={`flex-1 py-3 px-6 rounded-xl font-bold transition-all duration-200 ${
                  isAvailable 
                    ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-2 border-blue-600'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {adding 
                  ? (lang === 'vi' ? 'Đã thêm!' : 'Added!') 
                  : (lang === 'vi' ? 'Thêm vào giỏ' : 'Add to Cart')}
              </button>
              
              <button
                onClick={handleBuyNow}
                disabled={!isAvailable}
                className={`flex-1 py-3 px-6 rounded-xl font-bold text-white transition-all duration-200 shadow-lg ${
                  isAvailable 
                    ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/30'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                {lang === 'vi' ? 'Mua ngay' : 'Buy Now'}
              </button>
            </div>
            
            {!isAvailable && (
              <p className="text-red-500 text-sm mt-3 text-center">
                {lang === 'vi' 
                  ? 'Sản phẩm này tạm thời hết hàng.' 
                  : 'This product is currently out of stock.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
