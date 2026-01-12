import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { toast } from 'react-toastify';
import { Save, ArrowLeft, Plus, Trash2, Upload, Zap, AlertCircle, Layers } from 'lucide-react';
import { useLang } from '../../context/LangContext';

export default function ProductDetail() {
  const { t } = useLang();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = id !== 'new';
  
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState({
    title: '',
    description: '',
    price: 0,
    category: 'Voucher',
    is_digital: true,
    allow_api_restock: false,
    images: []
  });

  // Quản lý biến thể từ bảng product_variants
  const [variants, setVariants] = useState([]);
  const [deletedVariantIds, setDeletedVariantIds] = useState([]); // Theo dõi các ID cần xóa

  useEffect(() => {
    if (isEdit) fetchProductData();
  }, [id]);

  const fetchProductData = async () => {
    try {
        // 1. Lấy thông tin sản phẩm
        const { data: prodData, error: prodError } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();
        
        if (prodError) throw prodError;
        setProduct({
            ...prodData,
            allow_api_restock: prodData.allow_api_restock === true
        });

        // 2. Lấy danh sách biến thể từ bảng product_variants
        const { data: varData, error: varError } = await supabase
            .from('product_variants')
            .select('*')
            .eq('product_id', id)
            .order('id', { ascending: true });

        if (varError) throw varError;
        setVariants(varData || []);

    } catch (err) {
        toast.error("Lỗi tải dữ liệu: " + err.message);
    }
  };

  const handleImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const fileName = `prod_${Date.now()}`;
      const { error } = await supabase.storage.from('product-images').upload(fileName, file);
      if(error) return toast.error(error.message);
      const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
      setProduct({ ...product, images: [...(product.images||[]), data.publicUrl] });
  };

  // --- LOGIC UI BIẾN THỂ ---
  const addVariant = () => {
      // Thêm một dòng tạm thời (chưa có ID DB)
      setVariants([...variants, { 
          name: '', 
          sku: '', 
          price_mod: 0,
          is_new: true // Đánh dấu là mới để insert
      }]);
  };

  const removeVariant = (index) => {
      const item = variants[index];
      // Nếu là item đã có trong DB (có id), đưa vào danh sách chờ xóa
      if (!item.is_new && item.id) {
          setDeletedVariantIds([...deletedVariantIds, item.id]);
      }
      
      const newVars = [...variants];
      newVars.splice(index, 1);
      setVariants(newVars);
  };

  const updateVariant = (index, field, value) => {
      const newVars = [...variants];
      newVars[index][field] = value;
      
      // Auto-fill SKU thông minh: "VINA" + Tên biến thể (nếu SKU đang trống)
      if (field === 'name' && !newVars[index].sku && product.allow_api_restock) {
           const cleanName = value.toString().replace(/\D/g, ''); // Lấy số: 50,000 -> 50000
           // Logic demo: Nếu là Vina -> VINA50000. Cái này người dùng tự sửa lại được.
           newVars[index].sku = cleanName; 
      }
      setVariants(newVars);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
        // 1. Lưu Sản phẩm
        const prodPayload = { 
            title: product.title,
            description: product.description,
            price: product.price,
            category: product.category,
            is_digital: product.is_digital,
            images: product.images,
            allow_api_restock: product.allow_api_restock
        };

        let productId = id;

        if (isEdit) {
            await supabase.from('products').update(prodPayload).eq('id', id);
        } else {
            const { data: newProd, error } = await supabase.from('products').insert(prodPayload).select().single();
            if (error) throw error;
            productId = newProd.id;
        }

        // 2. Xử lý Biến thể (Cập nhật bảng product_variants)
        
        // A. Xóa các biến thể bị user remove
        if (deletedVariantIds.length > 0) {
            await supabase.from('product_variants').delete().in('id', deletedVariantIds);
        }

        // B. Upsert (Thêm mới hoặc Cập nhật)
        const variantsToUpsert = variants.map(v => ({
            id: v.is_new ? undefined : v.id, // Nếu mới thì ko gửi ID để DB tự sinh
            product_id: productId,
            name: v.name,
            sku: v.sku ? v.sku.toUpperCase() : null, // SKU luôn viết hoa
            price_mod: v.price_mod
        }));

        if (variantsToUpsert.length > 0) {
            const { error: varErr } = await supabase.from('product_variants').upsert(variantsToUpsert);
            if (varErr) throw varErr;
        }

        toast.success(t("Đã lưu thành công!", "Saved successfully!"));
        navigate('/admin/products');

    } catch (error) {
        toast.error("Lỗi lưu: " + error.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fade-in">
        <div className="flex items-center gap-4 mb-6">
            <button onClick={() => navigate('/admin/products')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                <ArrowLeft size={20}/>
            </button>
            <h1 className="text-2xl font-bold text-slate-800">
                {isEdit ? t(`Sửa sản phẩm #${id}`, `Edit Product #${id}`) : t('Thêm sản phẩm mới', 'New Product')}
            </h1>
        </div>

        <form onSubmit={handleSave} className="grid grid-cols-3 gap-8">
            <div className="col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                    <h3 className="font-bold text-slate-700 border-b pb-2">{t('Thông tin chung', 'General Info')}</h3>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">{t('Tên sản phẩm', 'Product Name')}</label>
                        <input required className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={product.title} onChange={e=>setProduct({...product, title: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">{t('Mô tả chi tiết', 'Description')}</label>
                        <textarea className="w-full border p-2 rounded-lg h-32 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={product.description} onChange={e=>setProduct({...product, description: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">{t('Danh mục', 'Category')}</label>
                            <select className="w-full border p-2 rounded-lg"
                                value={product.category} onChange={e=>setProduct({...product, category: e.target.value})}>
                                <option>Voucher</option>
                                <option>Game Key</option>
                                <option>Top-up</option>
                                <option>Software</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">{t('Loại hàng', 'Product Type')}</label>
                            <select className="w-full border p-2 rounded-lg"
                                value={product.is_digital} onChange={e=>setProduct({...product, is_digital: e.target.value === 'true'})}>
                                <option value="true">{t('Digital (Key/Code)', 'Digital (Key/Code)')}</option>
                                <option value="false">{t('Vật lý (Giao hàng)', 'Physical (Shipping)')}</option>
                            </select>
                        </div>
                    </div>

                    {/* API CHECKBOX */}
                    {product.is_digital && (
                        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex items-start gap-3 mt-2">
                             <input type="checkbox" className="mt-1 w-5 h-5 text-indigo-600 rounded cursor-pointer"
                                checked={product.allow_api_restock}
                                onChange={e => setProduct({...product, allow_api_restock: e.target.checked})}
                            />
                            <div>
                                <label className="block text-sm font-bold text-indigo-900 flex items-center gap-2">
                                    <Zap size={16}/> {t("Get Key over API if Out of Stock", "Get Key over API")}
                                </label>
                                <p className="text-xs text-indigo-700 mt-1">
                                    {t("Bật: Cấu hình Mã SKU bên dưới để gọi API khi hết kho.", "Enable: Configure SKU below for API calls.")}
                                </p>
                            </div>
                        </div>
                    )}
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">{t('Giá mặc định', 'Default Price')}</label>
                        <input type="number" className="w-full border p-2 rounded-lg font-mono"
                            value={product.price} onChange={e=>setProduct({...product, price: Number(e.target.value)})}
                        />
                    </div>
                </div>

                {/* QUẢN LÝ BIẾN THỂ (BẢNG MỚI) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <Layers size={18}/> {t('Danh sách Biến thể (Variants)', 'Variants')}
                        </h3>
                        <button type="button" onClick={addVariant} className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded-lg flex items-center gap-1 font-medium hover:bg-blue-100">
                            <Plus size={16}/> {t('Thêm biến thể', 'Add Variant')}
                        </button>
                    </div>

                    {variants.length === 0 ? (
                        <p className="text-sm text-slate-400 italic text-center py-4">{t('Chưa có biến thể (Bán theo giá gốc).', 'No variants.')}</p>
                    ) : (
                        <div className="space-y-3">
                            <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-500 uppercase bg-slate-50 p-2 rounded">
                                <div className="col-span-4">{t('Tên (VD: 50k)', 'Variant Name')}</div>
                                <div className="col-span-4 flex items-center gap-1">SKU / API Code {product.allow_api_restock && <Zap size={10} className="text-indigo-600"/>}</div>
                                <div className="col-span-3">{t('Giá (+/-)', 'Price')}</div>
                                <div className="col-span-1"></div>
                            </div>
                            {variants.map((v, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                    <div className="col-span-4">
                                        <input className="w-full border p-2 rounded outline-none focus:border-blue-500"
                                            placeholder="VD: 50,000" value={v.name}
                                            onChange={e => updateVariant(idx, 'name', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-4">
                                        <input 
                                            // Chỉ cho sửa SKU khi bật API mode (hoặc tùy ý bạn, ở đây tôi mở luôn cho tiện)
                                            className={`w-full border p-2 rounded font-mono text-sm outline-none ${product.allow_api_restock ? 'bg-white border-indigo-300 text-indigo-700 font-bold' : 'bg-slate-100 text-slate-400'}`}
                                            placeholder={product.allow_api_restock ? "VD: VINA50" : "Auto ID"} 
                                            value={v.sku || ''}
                                            onChange={e => updateVariant(idx, 'sku', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <input type="number" className="w-full border p-2 rounded text-right outline-none"
                                            placeholder="0" value={v.price_mod}
                                            onChange={e => updateVariant(idx, 'price_mod', Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="col-span-1 text-center">
                                        <button type="button" onClick={() => removeVariant(idx)} className="text-red-400 hover:text-red-600">
                                            <Trash2 size={18}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 flex gap-2 items-start text-xs text-yellow-700 mt-2">
                        <AlertCircle size={14} className="mt-0.5 shrink-0"/>
                        <p>{t('Mỗi biến thể sẽ có một ID riêng. Dùng SKU để map với hệ thống API (Appota, v.v).', 'Each variant has unique ID. Use SKU for API mapping.')}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-700 mb-4 border-b pb-2">{t('Hình ảnh', 'Images')}</h3>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        {product.images?.map((img, i) => (
                            <img key={i} src={img} className="w-full h-24 object-cover rounded border" alt="prod" />
                        ))}
                    </div>
                    <label className="block w-full border-2 border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition text-slate-500">
                        <Upload className="mx-auto mb-2" size={24}/>
                        <span className="text-sm">{t('Tải ảnh lên', 'Upload Image')}</span>
                        <input type="file" className="hidden" onChange={handleImageUpload}/>
                    </label>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                   <button disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:opacity-50 flex justify-center items-center gap-2">
                       {loading ? <span>Saving...</span> : <><Save size={18}/><span>{isEdit ? t('Cập nhật', 'Update') : t('Tạo mới', 'Create')}</span></>}
                   </button>
                </div>
            </div>
        </form>
    </div>
  );
}
