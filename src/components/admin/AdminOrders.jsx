import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  Search, Eye, Filter, ChevronLeft, ChevronRight, 
  Clock, CheckCircle, XCircle, AlertTriangle, Package, Calendar 
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useLang } from '../../context/LangContext'; // Import context ngôn ngữ

const AdminOrders = () => {
  const { t, lang } = useLang(); // Sử dụng hook ngôn ngữ
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null); 
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    fetchOrders();
  }, [page, filterStatus]); 

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // Đảm bảo query lấy đủ thông tin order_items và products
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            quantity,
            price_at_purchase,
            product_name,
            variant_name,
            products (
              title,
              title_en,
              images
            )
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      if (searchTerm) {
        query = query.or(`customer_email.ilike.%${searchTerm}%,oxapay_track_id.ilike.%${searchTerm}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error(t('Không thể tải danh sách đơn hàng', 'Failed to fetch orders'));
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  // Helper: Format ngày tháng theo ngôn ngữ
  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US');
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US');
  };

  // Helper: Status Badge (Đa ngôn ngữ)
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

    const labels = {
      pending: t('Chờ xử lý', 'Pending'),
      paid: t('Đã thanh toán', 'Paid'),
      completed: t('Hoàn thành', 'Completed'),
      expired: t('Hết hạn', 'Expired'),
      failed: t('Thất bại', 'Failed'),
    };

    return (
      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.expired}`}>
        {icons[status] || <Clock size={14} />}
        <span className="capitalize">{labels[status] || status}</span>
      </span>
    );
  };

  // Labels cho bộ lọc
  const filterLabels = {
      all: t('Tất cả', 'All'),
      pending: t('Chờ xử lý', 'Pending'),
      paid: t('Đã thanh toán', 'Paid'),
      completed: t('Hoàn thành', 'Completed'),
      expired: t('Hết hạn', 'Expired'),
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      {/* HEADER & FILTER */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-slate-800">{t('Quản lý Đơn hàng', 'Order Management')}</h2>
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
              placeholder={t('Tìm theo email, Order ID...', 'Search by email, Order ID...')} 
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
                {filterLabels[status]}
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
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">{t('Mã đơn', 'Order ID')}</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">{t('Khách hàng', 'Customer')}</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">{t('Tổng tiền', 'Total Amount')}</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">{t('Trạng thái', 'Status')}</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">{t('Ngày tạo', 'Created At')}</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase">{t('Hành động', 'Actions')}</th>
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
                  {t('Không tìm thấy đơn hàng nào.', 'No orders found.')}
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
                    {formatDate(order.created_at)}
                    <div className="text-xs text-slate-400">{formatTime(order.created_at)}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setSelectedOrder(order)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title={t('Xem chi tiết', 'View Details')}
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
          {t('Trang', 'Page')} {page}
        </span>
        <button 
          onClick={() => setPage(p => p + 1)}
          disabled={orders.length < ITEMS_PER_PAGE}
          className="p-2 border rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* MODAL CHI TIẾT ĐƠN HÀNG */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in-up">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-800">
                    {t('Chi tiết đơn hàng', 'Order Details')} #{selectedOrder.id}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {t('Ngày tạo:', 'Created Date:')} {new Date(selectedOrder.created_at).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')}
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
                    <Filter size={16}/> {t('Thông tin khách hàng', 'Customer Info')}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-blue-600 font-medium w-24 inline-block">{t('Họ tên:', 'Name:')}</span> {selectedOrder.customer_name}</p>
                    <p><span className="text-blue-600 font-medium w-24 inline-block">{t('Email:', 'Email:')}</span> {selectedOrder.customer_email}</p>
                    <p><span className="text-blue-600 font-medium w-24 inline-block">{t('Liên hệ:', 'Contact:')}</span> {selectedOrder.contact_method} - {selectedOrder.contact_info}</p>
                    <p><span className="text-blue-600 font-medium w-24 inline-block">{t('Địa chỉ:', 'Address:')}</span> {selectedOrder.shipping_address || 'N/A'}</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Package size={16}/> {t('Thông tin thanh toán', 'Payment Info')}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-slate-500 font-medium w-32 inline-block">{t('Trạng thái:', 'Status:')}</span> {getStatusBadge(selectedOrder.status)}</p>
                    <p><span className="text-slate-500 font-medium w-32 inline-block">{t('Tổng tiền:', 'Total:')}</span> <span className="font-bold text-green-600 text-lg">{formatCurrency(selectedOrder.amount)}</span></p>
                    <p><span className="text-slate-500 font-medium w-32 inline-block">{t('Track ID:', 'Track ID:')}</span> <span className="font-mono bg-slate-200 px-2 py-0.5 rounded text-xs">{selectedOrder.oxapay_track_id || t('Chưa có', 'None')}</span></p>
                    <p><span className="text-slate-500 font-medium w-32 inline-block">{t('Phương thức:', 'Method:')}</span> Crypto (OxaPay)</p>
                  </div>
                </div>
              </div>

              {/* Danh sách sản phẩm */}
              <div>
                <h4 className="font-bold text-slate-800 mb-4 border-l-4 border-blue-600 pl-3">{t('Sản phẩm đã mua', 'Purchased Items')}</h4>
                <div className="border rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">{t('Sản phẩm', 'Product')}</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-600">{t('SL', 'Qty')}</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-600">{t('Đơn giá', 'Unit Price')}</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-600">{t('Thành tiền', 'Total')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedOrder.order_items?.map((item, idx) => {
                        // Logic hiển thị: Ưu tiên tên lưu trong item (snapshot) rồi mới tới tên từ bảng products
                        const displayName = item.product_name || item.products?.title || 'Unknown Product';
                        // Logic hiển thị biến thể: lấy từ variant_name lưu trong item
                        const variantInfo = item.variant_name; 

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
                                  {variantInfo && (
                                    <div className="text-xs text-slate-400">{t('Loại:', 'Variant:')} {variantInfo}</div>
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

              {/* Ghi chú hệ thống */}
              {selectedOrder.notes && (
                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 text-sm text-yellow-800">
                  <span className="font-bold block mb-1">{t('Ghi chú hệ thống:', 'System Notes:')}</span>
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
