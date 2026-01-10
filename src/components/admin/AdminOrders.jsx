import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function AdminOrders() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    
    // State cho việc update status
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [newStatus, setNewStatus] = useState('');

    useEffect(() => {
        fetchOrders();
        
        // Realtime subscription
        const channel = supabase
            .channel('admin-orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchOrders();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    async function fetchOrders() {
        // Load orders kèm items và product info
        const { data, error } = await supabase
            .from('orders')
            .select('*, order_items(*, products(title))')
            .order('created_at', { ascending: false });
        
        if (error) console.error("Error fetching orders:", error);
        else setOrders(data || []);
        setLoading(false);
    }

    const handleViewOrder = (order) => {
        setSelectedOrder(order);
        setNewStatus(order.status); // Set status hiện tại vào dropdown
    };

    const handleDeleteOrder = async (id) => {
        if (!confirm("Bạn có chắc muốn xóa đơn này?")) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ action: 'delete_order', orderId: id })
            });
            if (!res.ok) throw new Error("Failed to delete");
            // Fetch lại trigger bởi realtime rồi nên ko cần gọi lại manual, nhưng gọi cho chắc
            fetchOrders();
            if (selectedOrder?.id === id) setSelectedOrder(null);
        } catch (err) {
            alert(err.message);
        }
    };

    // Hàm gọi Action cập nhật trạng thái
    const handleUpdateStatus = async () => {
        if (!selectedOrder) return;
        setUpdatingStatus(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ 
                    action: 'update_order_status', 
                    orderId: selectedOrder.id,
                    status: newStatus,
                    customerEmail: selectedOrder.customer_email
                })
            });
            
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Update failed");

            alert("Cập nhật trạng thái thành công!");
            setSelectedOrder({ ...selectedOrder, status: newStatus }); // Update UI tạm
        } catch (err) {
            alert(err.message);
        } finally {
            setUpdatingStatus(false);
        }
    };

    if (loading) return <div>Loading orders...</div>;

    return (
        <div>
            <h2 className="text-xl font-bold mb-4">Quản lý Đơn hàng</h2>
            <div className="overflow-x-auto bg-white rounded shadow">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-100 border-b">
                            <th className="p-3">ID</th>
                            <th className="p-3">Khách hàng</th>
                            <th className="p-3">Tổng tiền</th>
                            <th className="p-3">Trạng thái</th>
                            <th className="p-3">Ngày tạo</th>
                            <th className="p-3">Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map(order => (
                            <tr key={order.id} className="border-b hover:bg-gray-50">
                                <td className="p-3">#{order.id}</td>
                                <td className="p-3">
                                    <div className="font-medium">{order.customer_email}</div>
                                    <div className="text-xs text-gray-500">{order.customer_name}</div>
                                </td>
                                <td className="p-3">${order.amount}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold 
                                        ${order.status === 'paid' ? 'bg-green-100 text-green-800' : 
                                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                                          order.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                          'bg-gray-100 text-gray-800'}`}>
                                        {order.status}
                                    </span>
                                </td>
                                <td className="p-3 text-sm text-gray-500">
                                    {new Date(order.created_at).toLocaleString()}
                                </td>
                                <td className="p-3 space-x-2">
                                    <button 
                                        onClick={() => handleViewOrder(order)}
                                        className="text-blue-600 hover:underline">
                                        Chi tiết
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteOrder(order.id)}
                                        className="text-red-600 hover:underline">
                                        Xóa
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal Chi tiết đơn hàng */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Chi tiết đơn hàng #{selectedOrder.id}</h3>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-gray-700">✕</button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                            <div>
                                <p><strong>Email:</strong> {selectedOrder.customer_email}</p>
                                <p><strong>Tên khách:</strong> {selectedOrder.customer_name || '---'}</p>
                                <p><strong>SĐT:</strong> {selectedOrder.phone_number || selectedOrder.contact_info || '---'}</p>
                            </div>
                            <div>
                                <p><strong>Ngày tạo:</strong> {new Date(selectedOrder.created_at).toLocaleString()}</p>
                                <p><strong>Mã vận đơn (TrackID):</strong> {selectedOrder.oxapay_track_id || '---'}</p>
                                {/* [MỚI] HIỂN THỊ ĐỊA CHỈ */}
                                <p className="mt-1">
                                    <strong>Địa chỉ giao hàng:</strong><br/>
                                    <span className="bg-yellow-50 block p-1 border rounded mt-1">
                                        {selectedOrder.shipping_address || 'Không có địa chỉ (Sản phẩm Digital?)'}
                                    </span>
                                </p>
                            </div>
                        </div>

                        {/* [MỚI] KHU VỰC CẬP NHẬT TRẠNG THÁI */}
                        <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200">
                            <h4 className="font-bold mb-2 text-gray-700">Cập nhật trạng thái đơn hàng</h4>
                            <div className="flex gap-2">
                                <select 
                                    value={newStatus} 
                                    onChange={(e) => setNewStatus(e.target.value)}
                                    className="border rounded p-2 flex-1"
                                >
                                    <option value="pending">Pending (Chờ thanh toán)</option>
                                    <option value="paid">Paid (Đã thanh toán - Chờ xử lý)</option>
                                    <option value="shipping">Shipping (Đang vận chuyển)</option>
                                    <option value="completed">Completed (Hoàn thành)</option>
                                    <option value="cancelled">Cancelled (Hủy)</option>
                                </select>
                                <button 
                                    onClick={handleUpdateStatus}
                                    disabled={updatingStatus}
                                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {updatingStatus ? 'Đang lưu...' : 'Cập nhật'}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                * Lưu ý: Việc cập nhật trạng thái sẽ gửi thông báo đến người dùng.
                            </p>
                        </div>

                        <div className="border-t pt-4">
                            <h4 className="font-bold mb-2">Sản phẩm</h4>
                            <ul className="space-y-2">
                                {selectedOrder.order_items.map(item => (
                                    <li key={item.id} className="flex justify-between border-b pb-2">
                                        <div>
                                            <div className="font-medium">
                                                {item.product_name || item.products?.title}
                                                {item.variant_name && <span className="text-gray-500"> ({item.variant_name})</span>}
                                            </div>
                                            <div className="text-sm text-gray-500">x {item.quantity}</div>
                                            {item.assigned_key && (
                                                <div className="text-xs text-green-600 mt-1 bg-green-50 p-1 rounded font-mono">
                                                    Key: {item.assigned_key.substring(0, 50)}...
                                                </div>
                                            )}
                                        </div>
                                        <div className="font-bold">
                                            ${item.price_at_purchase}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        
                        <div className="text-right mt-4 pt-4 border-t text-xl font-bold">
                            Tổng cộng: ${selectedOrder.amount}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
