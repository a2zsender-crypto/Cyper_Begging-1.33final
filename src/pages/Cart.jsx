import React, { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { CartContext } from '../context/CartContext';
import { supabase } from '../supabaseClient';
// Import các assets nếu cần thiết, giữ nguyên logic hiển thị
import { Trash2, Plus, Minus, ArrowLeft, ShoppingBag } from 'lucide-react';

const Cart = () => {
  const { cartItems, removeFromCart, updateQuantity, getCartTotal, clearCart } = useContext(CartContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      const totalAmount = getCartTotal();
      
      if (totalAmount <= 0) {
        throw new Error("Cart is empty");
      }

      // Gọi Edge Function 'payment-handler'
      const { data, error: funcError } = await supabase.functions.invoke('payment-handler', {
        body: {
          amount: totalAmount,
          orderId: `ORD-${Date.now()}`, // Tạo mã đơn hàng tạm thời
          items: cartItems.map(item => ({
             id: item.id,
             name: item.name,
             quantity: item.quantity,
             price: item.price
          }))
        }
      });

      if (funcError) {
        console.error("Supabase Function Error:", funcError);
        throw new Error(funcError.message || "Payment initiation failed");
      }

      if (data && data.payLink) {
        // Xóa giỏ hàng trước khi chuyển hướng (tuỳ chọn, dựa theo logic gốc)
        // clearCart(); 
        
        // Chuyển hướng sang trang thanh toán OxaPay
        window.location.href = data.payLink;
      } else {
        throw new Error("No payment link received from payment gateway");
      }

    } catch (err) {
      console.error("Checkout Error:", err);
      setError(err.message || "An error occurred during checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="flex justify-center mb-6">
          <ShoppingBag size={64} className="text-gray-300" />
        </div>
        <h2 className="text-2xl font-bold mb-4">Your Cart is Empty</h2>
        <p className="text-gray-600 mb-8">Looks like you haven't added any products to your cart yet.</p>
        <Link 
          to="/products" 
          className="inline-flex items-center bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft size={20} className="mr-2" />
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>
      
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Cart Items List */}
        <div className="lg:w-2/3">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 space-y-6">
              {cartItems.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row items-center gap-4 py-4 border-b last:border-0">
                  <div className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded-md overflow-hidden">
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="font-semibold text-lg text-gray-800">{item.name}</h3>
                    <p className="text-gray-500 text-sm mt-1">{item.description}</p>
                    <div className="mt-2 font-medium text-blue-600">${item.price}</div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center border border-gray-300 rounded-lg">
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="p-2 hover:bg-gray-100 transition-colors"
                        disabled={item.quantity <= 1}
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-10 text-center font-medium">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-2 hover:bg-gray-100 transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    
                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                      title="Remove item"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:w-1/3">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-24">
            <h2 className="text-xl font-bold mb-6">Order Summary</h2>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>${getCartTotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span className="text-green-600">Free</span>
              </div>
              <div className="border-t pt-4 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>${getCartTotal().toFixed(2)}</span>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={loading}
              className={`w-full py-4 rounded-lg font-bold text-lg text-white transition-all
                ${loading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl'
                }`}
            >
              {loading ? 'Processing...' : 'Proceed to Checkout'}
            </button>
            
            <p className="text-center text-xs text-gray-500 mt-4">
              Secure payment powered by OxaPay
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
