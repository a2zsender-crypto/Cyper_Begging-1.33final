import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  Search, Eye, Filter, ChevronLeft, ChevronRight, 
  Clock, CheckCircle, XCircle, AlertTriangle, Package, Calendar 
} from 'lucide-react';
import { toast } from 'react-toastify';

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null); // State cho Modal chi tiết
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    fetchOrders();
  }, [page, filterStatus]); // Reload khi đổi trang hoặc filter

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (
              title,
              title_en,
              images,
              price
            )
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      // Lưu ý: Search text trên Supabase cần cấu hình thêm, ở đây xử lý cơ bản
      if (searchTerm) {
        query = query.or(`customer_email.ilike.%${searchTerm}%,oxapay_track_id.ilike.%${searchTerm}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Không thể tải danh sách đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  // Helper: Format tiền tệ
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  // Helper: Status Badge
  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      paid: 'bg-blue-100 text-blue-800 border-blue-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      expired: 'bg-gray-100 text-gray-800 border-gray-200',
      failed: 'bg-red-100 text-red-800 border-red-200',
    };
    
    const icons = {
      pending: <Clock size={14} />,
      paid: <CheckCircle size={14} />,
      completed: <Package size={14} />,
      expired: <AlertTriangle size={14} />,
      failed: <XCircle size={14} />,
    };

    return (
      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.expired}`}>
        {icons[status] || <Clock size={14} />}
        <span className="capitalize">{status}</span>
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      {/* HEADER & FILTER */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-slate-800">Quản lý Đơn hàng</h2>
          <div className="flex gap-2">
            <button onClick={fetchOrders} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
              <Clock size={20} />
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Tìm theo email, Order ID..." 
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchOrders()}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            {['all', 'pending', 'paid', 'completed', 'expired'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border
                  ${filterStatus === status 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Order ID</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Khách hàng</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Tổng tiền</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Trạng thái</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Ngày tạo</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan="6" className="px-6 py-4">
                    <div className="h-10 bg-slate-100 rounded"></div>
                  </td>
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                  Không tìm thấy đơn hàng nào.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    #{order.id}
                    <div className="text-xs text-slate-400 mt-1">{order.oxapay_track_id || '-'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-900">{order.customer_name || 'Guest'}</div>
                    <div className="text-xs text-slate-500">{order.customer_email}</div>
                  </td>
                  <td className="px-6 py-4 font-bold text-green-600">
                    {formatCurrency(order.amount)}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(order.status)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(order.created_at).toLocaleDateString('vi-VN')}
                    <div className="text-xs text-slate-400">{new Date(order.created_at).toLocaleTimeString('vi-VN')}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setSelectedOrder(order)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Xem chi tiết"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div className="p-4 border-t border-slate-100 flex justify-center gap-2">
        <button 
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="p-2 border rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="px-4 py-2 bg-slate-50 rounded-lg text-sm font-medium flex items-center">
          Trang {page}
        </span>
        <button 
          onClick={() => setPage(p => p + 1)}
          disabled={orders.length < ITEMS_PER_PAGE}
          className="p-2 border rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* MODAL CHI TIẾT ĐƠN HÀNG (SỬA LỖI HIỂN THỊ BIẾN THỂ TẠI ĐÂY) */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in-up">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Chi tiết đơn hàng #{selectedOrder.id}</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Ngày tạo: {new Date(selectedOrder.created_at).toLocaleString('vi-VN')}
                </p>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
              >
                <XCircle size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-8">
              
              {/* Thông tin khách hàng */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                    <Filter size={16}/> Thông tin khách hàng
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-blue-600 font-medium w-24 inline-block">Họ tên:</span> {selectedOrder.customer_name}</p>
                    <p><span className="text-blue-600 font-medium w-24 inline-block">Email:</span> {selectedOrder.customer_email}</p>
                    <p><span className="text-blue-600 font-medium w-24 inline-block">Liên hệ:</span> {selectedOrder.contact_method} - {selectedOrder.contact_info}</p>
                    <p><span className="text-blue-600 font-medium w-24 inline-block">Địa chỉ:</span> {selectedOrder.shipping_address || 'N/A'}</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Package size={16}/> Thông tin thanh toán
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-slate-500 font-medium w-32 inline-block">Trạng thái:</span> {getStatusBadge(selectedOrder.status)}</p>
                    <p><span className="text-slate-500 font-medium w-32 inline-block">Tổng tiền:</span> <span className="font-bold text-green-600 text-lg">{formatCurrency(selectedOrder.amount)}</span></p>
                    <p><span className="text-slate-500 font-medium w-32 inline-block">Track ID:</span> <span className="font-mono bg-slate-200 px-2 py-0.5 rounded text-xs">{selectedOrder.oxapay_track_id || 'Chưa có'}</span></p>
                    <p><span className="text-slate-500 font-medium w-32 inline-block">Phương thức:</span> Crypto (OxaPay)</p>
                  </div>
                </div>
              </div>

              {/* Danh sách sản phẩm */}
              <div>
                <h4 className="font-bold text-slate-800 mb-4 border-l-4 border-blue-600 pl-3">Sản phẩm đã mua</h4>
                <div className="border rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Sản phẩm</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-600">SL</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-600">Đơn giá</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-600">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedOrder.order_items?.map((item, idx) => {
                        // --- LOGIC HIỂN THỊ TÊN SẢN PHẨM + BIẾN THỂ ---
                        // Ưu tiên 1: item.product_name (Tên đầy đủ lưu lúc mua)
                        // Ưu tiên 2: item.name (Cột dự phòng)
                        // Ưu tiên 3: item.products.title (Tên gốc trong kho - fallback)
                        
                        const displayName = item.product_name || item.name || item.products?.title || 'Unknown Product';
                        const originalName = item.products?.title;
                        const isVariant = displayName !== originalName;

                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {item.products?.images?.[0] && (
                                  <img src={item.products.images[0]} alt="" className="w-10 h-10 rounded border object-cover" />
                                )}
                                <div>
                                  <div className="font-medium text-slate-900">
                                    {displayName}
                                  </div>
                                  {/* Nếu tên hiển thị khác tên gốc (tức là có biến thể), ta có thể hiển thị thêm tên gốc mờ mờ để đối chiếu nếu cần */}
                                  {isVariant && originalName && (
                                    <div className="text-xs text-slate-400">Gốc: {originalName}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-medium">{item.quantity}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(item.price_at_purchase)}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800">
                              {formatCurrency(item.price_at_purchase * item.quantity)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Ghi chú hệ thống (Nếu có) */}
              {selectedOrder.notes && (
                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 text-sm text-yellow-800">
                  <span className="font-bold block mb-1">Ghi chú hệ thống:</span>
                  {selectedOrder.notes}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
