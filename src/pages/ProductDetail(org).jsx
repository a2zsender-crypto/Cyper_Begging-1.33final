import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Thêm useNavigate
import { supabase } from '../supabaseClient';
import { useCart } from '../context/CartContext';
import { useLang } from '../context/LangContext';
import { ShoppingCart, CreditCard, CheckCircle } from 'lucide-react'; // Thêm icon

export default function ProductDetail() {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { lang, t } = useLang();
  const navigate = useNavigate(); // Hook điều hướng
  const [product, setProduct] = useState(null);
  const [mainImg, setMainImg] = useState('');

  useEffect(() => {
    supabase.from('products').select('*').eq('id', id).single().then(({ data }) => {
      setProduct(data);
      if (data?.images?.length) setMainImg(data.images[0]);
    });
  }, [id]);

  // Xử lý Thêm vào giỏ (Ở lại trang)
  const handleAddToCart = () => {
      if(product) {
          addToCart(product);
          // Nếu bạn đã cài react-toastify ở bước trước thì thay alert bằng toast.success
          alert(t("Đã thêm vào giỏ hàng!", "Added to cart successfully!"));
      }
  }

  // Xử lý Mua ngay (Chuyển sang trang thanh toán)
  const handleBuyNow = () => {
      if(product) {
          addToCart(product);
          navigate('/cart'); // Chuyển hướng ngay
      }
  }

  if (!product) return (
    <div className="flex justify-center items-center h-64 text-slate-400">
        Loading...
    </div>
  );

  const displayTitle = lang === 'vi' ? product.title : (product.title_en || product.title);
  const displayDesc = lang === 'vi' ? product.description : (product.description_en || product.description);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 md:flex gap-10">
        
        {/* CỘT TRÁI: ẢNH SẢN PHẨM */}
        <div className="md:w-1/2 flex flex-col gap-4">
          <div className="h-80 md:h-96 bg-gray-50 rounded-2xl overflow-hidden border border-slate-100 flex items-center justify-center p-4">
            <img src={mainImg} alt={displayTitle} className="w-full h-full object-contain hover:scale-105 transition duration-500" />
          </div>
          {/* List ảnh nhỏ */}
          {product.images?.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {product.images.map((img, idx) => (
                <img key={idx} src={img} onClick={() => setMainImg(img)} 
                  className={`w-20 h-20 object-cover rounded-xl cursor-pointer border-2 transition ${mainImg === img ? 'border-blue-600 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`} 
                />
              ))}
            </div>
          )}
        </div>

        {/* CỘT PHẢI: THÔNG TIN & NÚT MUA */}
        <div className="md:w-1/2 mt-8 md:mt-0 flex flex-col">
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 mb-4 leading-tight">{displayTitle}</h1>
          
          <div className="flex items-center gap-4 mb-6">
             <div className="text-3xl font-extrabold text-green-600">{product.price} USDT</div>
             {product.is_digital ? (
                 <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full uppercase tracking-wide">Digital Key</span>
             ) : (
                 <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full uppercase tracking-wide">Physical</span>
             )}
          </div>
          
          <div className="prose max-w-none text-slate-600 mb-8 whitespace-pre-wrap border-t border-slate-100 pt-6 text-base leading-relaxed">
            {displayDesc || (lang === 'en' ? "No description available." : "Chưa có mô tả chi tiết.")}
          </div>

          <div className="mt-auto space-y-4">
            {/* KHU VỰC NÚT BẤM */}
            <div className="flex gap-4">
              {/* Nút Thêm giỏ (Màu trắng/viền xanh) */}
              <button 
                onClick={handleAddToCart} 
                className="flex-1 bg-white border-2 border-blue-600 text-blue-600 py-3.5 rounded-xl font-bold hover:bg-blue-50 transition flex items-center justify-center gap-2"
              >
                <ShoppingCart size={20}/>
                {t('THÊM GIỎ HÀNG', 'ADD TO CART')}
              </button>
              
              {/* Nút Mua ngay (Màu đỏ nổi bật) */}
              <button 
                onClick={handleBuyNow} 
                className="flex-1 bg-red-600 text-white py-3.5 rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition flex items-center justify-center gap-2"
              >
                <CreditCard size={20}/>
                {t('MUA NGAY', 'BUY NOW')}
              </button>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800 border border-blue-100 flex items-start gap-3">
              <CheckCircle size={18} className="mt-0.5 flex-shrink-0"/>
              <div>
                  <strong>{t('Bảo mật tuyệt đối:', 'Secure Payment:')}</strong> {t('Sản phẩm số sẽ được gửi tự động qua Email ngay sau khi thanh toán thành công.', 'Digital products are sent automatically via Email immediately after successful payment.')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
