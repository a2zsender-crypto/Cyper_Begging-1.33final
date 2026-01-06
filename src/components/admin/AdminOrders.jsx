import { useState, useMemo } from 'react'; 
import { supabase } from '../../supabaseClient';
import { CheckCircle, XCircle, Clock, Eye, RefreshCw, X, MapPin, ShoppingBag } from 'lucide-react';
import { useLang } from '../../context/LangContext';
import { useCart } from '../../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useQuery } from '@tanstack/react-query'; 

export default function AdminOrders({ session, role }) {
  const { t, lang } = useLang();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  
  const [orderFilter, setOrderFilter] = useState('all');
  const [showOrderDetail, setShowOrderDetail] = useState(null);

  // FETCH ORDERS BẰNG REACT QUERY
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['admin-orders', role, session?.user?.email], 
    queryFn: async () => {
        let qOrders = supabase.from('orders').select('*, order_items(*, products(title, title_en, images, price))').order('id', {ascending: false});
        
        if (role === 'user' && session?.user?.email) {
            qOrders = qOrders.eq('customer_email', session.user.email);
        }
        
        const { data, error } = await qOrders;
        if (error) throw error;
        return data;
    },
    enabled: !!session 
  });

  // --- HELPERS ---
  const checkExpired = (createdAt) => {
      if (!createdAt) return false;
      const created = new Date(createdAt);
      const now = new Date();
      return (now - created) / (1000 * 60 * 60) > 1; 
  };

  const filteredOrders = useMemo(() => {
      if (!Array.isArray(orders)) return [];
      
      return orders.filter(o => {
          const isExpired = checkExpired(o.created_at);
          if (role === 'user') return true; 
          
          if (orderFilter === 'all') return true;
          if (orderFilter === 'paid') return o.status === 'paid';
          if (orderFilter === 'pending') return (o.status === 'pending' && !isExpired);
          return true;
      });
  }, [orders, orderFilter, role]);

  const handleReOrder = (order) => {
      if (!order.order_items) return;
      order.order_items.forEach(item => {
          if (!item.products) return; 
          const productToAdd = {
              id: item.products.id || item.product_id,
              title: item.products.title,
              title_en: item.products.title_en,
              price: item.products.price, 
              images: item.products.images,
              // Giả sử variant được lưu trong item (nếu db hỗ trợ)
              selectedVariants: item.selected_variants || {} 
          };
          for(let i=0; i<item.quantity; i++) addToCart(productToAdd);
      });
      toast.success(t('Đã thêm sản phẩm vào giỏ hàng!', 'Added products to cart!'));
      navigate('/cart');
  };

  // Helper render variants string
  const renderVariants = (variantsObj) => {
      if (!variantsObj || Object.keys(variantsObj).length === 0) return null;
      return (
          <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(variantsObj).map(([key, val]) => (
                  <span key={key} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                      {key}: {val}
                  </span>
              ))}
          </div>
      );
  };

  if (isLoading) return <div className="p-8 text-center">Loading Orders...</div>;

  return (
    <div className="animate-fade-in">
       <h2 className="text-2xl font-bold mb-6 text-slate-800">{role === 'admin' ? t('Quản lý Đơn hàng', 'All Orders') : t('Lịch sử đơn hàng', 'Order History')}</h2>
       
       {role === 'admin' && (
           <div className="flex gap-2 mb-6">
               <button onClick={() => setOrderFilter('all')} className={`px-4 py-2 rounded-lg font-bold text-sm transition ${orderFilter==='all' ? 'bg-blue-600 text-white' : 'bg-white border text-slate-600 hover:bg-slate-50'}`}>All</button>
               <button onClick={() => setOrderFilter('paid')} className={`px-4 py-2 rounded-lg font-bold text-sm transition ${orderFilter==='paid' ? 'bg-green-600 text-white' : 'bg-white border text-slate-600 hover:bg-slate-50'}`}>Paid</button>
               <button onClick={() => setOrderFilter('pending')} className={`px-4 py-2 rounded-lg font-bold text-sm transition ${orderFilter==='pending' ? 'bg-yellow-500 text-white' : 'bg-white border text-slate-600 hover:bg-slate-50'}`}>Pending</button>
           </div>
       )}

       <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b text-slate-500 text-xs uppercase font-bold tracking-wider"><tr><th className="p-4">ID / Date</th><th className="p-4">Total</th><th className="p-4">Status</th><th className="p-4">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length > 0 ? filteredOrders.map(o => {
                  const isExpired = checkExpired(o.created_at);
                  const status = o.status ? o.status.toLowerCase() : 'unknown';
                  let statusBadge = <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">Unknown</span>;
                  
                  if (status === 'paid') statusBadge = <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-fit"><CheckCircle size={12}/> {t('Thành công', 'Paid')}</span>;
                  else if (status === 'pending') {
                      if (isExpired) statusBadge = <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-fit"><XCircle size={12}/> {t('Hết hạn', 'Expired')}</span>;
                      else statusBadge = <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-fit"><Clock size={12}/> {t('Chờ thanh toán', 'Pending')}</span>;
                  }

                  return (
                    <tr key={o.id} className="hover:bg-slate-50 cursor-pointer transition" onClick={() => setShowOrderDetail(o)}>
                        <td className="p-4">
                            <div className="font-mono text-sm font-bold text-slate-700">#{o.id}</div>
                            <div className="text-xs text-slate-400">{new Date(o.created_at).toLocaleString()}</div>
                        </td>
                        <td className="p-4 font-bold text-green-600">{o.amount} USDT</td>
                        <td className="p-4">{statusBadge}</td>
                        <td className="p-4">
                            {role !== 'admin' && (status === 'pending' || isExpired || status === 'canceled') ? (
                                <button onClick={(e) => { e.stopPropagation(); handleReOrder(o); }} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1 shadow-sm transition">
                                    <RefreshCw size={12}/> {t('Mua lại', 'Re-order')}
                                </button>
                            ) : (
                                <button onClick={(e) => {e.stopPropagation(); setShowOrderDetail(o)}} className="text-blue-500 bg-blue-50 p-2 rounded hover:bg-blue-100 transition"><Eye size={18}/></button>
                            )}
                        </td>
                    </tr>
                  );
              }) : (
                  <tr><td colSpan="4" className="p-8 text-center text-slate-400">{t('Chưa có đơn hàng nào.', 'No orders found.')}</td></tr>
              )}
            </tbody>
          </table>
       </div>

       {/* MODAL ORDER DETAIL */}
       {showOrderDetail && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
                <div className="p-5 border-b flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800">{t('Chi tiết đơn hàng', 'Order Detail')} #{showOrderDetail.id}</h3>
                    <button onClick={() => setShowOrderDetail(null)} className="text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition"><X/></button>
                </div>
                <div className="p-6 overflow-auto">
                    <div className="grid grid-cols-2 gap-4 mb-6 bg-blue-50 p-5 rounded-xl border border-blue-100 text-sm">
                        <div><p className="text-slate-500 font-bold uppercase text-xs mb-1">Customer</p><p className="font-medium text-slate-800">{showOrderDetail.customer_name}</p></div>
                        <div><p className="text-slate-500 font-bold uppercase text-xs mb-1">Email</p><p className="font-medium text-slate-800">{showOrderDetail.customer_email}</p></div>
                        <div><p className="text-slate-500 font-bold uppercase text-xs mb-1">Status</p><span className={`font-bold ${showOrderDetail.status==='paid'?'text-green-600':'text-yellow-600'}`}>{showOrderDetail.status?.toUpperCase()}</span></div>
                        <div><p className="text-slate-500 font-bold uppercase text-xs mb-1">Date</p><p className="font-medium text-slate-800">{new Date(showOrderDetail.created_at).toLocaleString()}</p></div>
                        {showOrderDetail.shipping_address && (
                            <div className="col-span-2 mt-2 pt-3 border-t border-blue-200">
                                <p className="text-slate-500 font-bold uppercase text-xs mb-1 flex items-center gap-1"><MapPin size={12}/> Shipping Address</p>
                                <p className="font-medium text-slate-800">📞 {showOrderDetail.phone_number}</p>
                                <p className="font-medium text-slate-800 mt-1">📍 {showOrderDetail.shipping_address}</p>
                            </div>
                        )}
                    </div>
                    <h4 className="font-bold mb-3 flex items-center gap-2 text-slate-700"><ShoppingBag size={18}/> Items</h4>
                    <div className="space-y-3">
                        {showOrderDetail.order_items?.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center border p-3 rounded-xl hover:bg-slate-50 transition">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 bg-slate-100 rounded-lg overflow-hidden border border-slate-200"><img src={item.products?.images?.[0]} className="h-full w-full object-cover"/></div>
                                    <div>
                                        <p className="font-bold text-sm text-slate-800 line-clamp-1">{lang === 'vi' ? item.products?.title : (item.products?.title_en || item.products?.title)}</p>
                                        {/* Hiển thị variants nếu có */}
                                        {renderVariants(item.selected_variants)}
                                        <p className="text-xs text-slate-500 mt-0.5">Quantity: x{item.quantity}</p>
                                    </div>
                                </div>
                                <div className="font-mono font-bold text-green-600 text-base">{item.price_at_purchase} USDT</div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-5 border-t bg-slate-50 flex justify-between items-center">
                    <span className="font-bold text-slate-600">Total Amount:</span>
                    <span className="text-2xl font-extrabold text-green-600">{showOrderDetail.amount} USDT</span>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}