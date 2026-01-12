import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { toast } from 'react-toastify';
import { Save, ArrowLeft, Plus, Trash2, Upload, Zap, AlertCircle, Layers } from 'lucide-react';
import { useLang } from '../../context/LangContext';

// Hàm helper tạo mã SKU tự động
const generateSlug = (text) => {
  if (!text) return '';
  return text.toString().toLowerCase().trim()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, "a")
    .replace(/[èéẹẻẽêềếệểễ]/g, "e")
    .replace(/[ìíịỉĩ]/g, "i")
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, "o")
    .replace(/[ùúụủũưừứựửữ]/g, "u")
    .replace(/[ỳýỵỷỹ]/g, "y")
    .replace(/đ/g, "d")
    .replace(/\s+/g, '-')     
    .replace(/[^\w\-]+/g, '') 
    .replace(/\-\-+/g, '-');  
};

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
    images: [],
    variants: [] // Cấu trúc: [{ name: "Mệnh giá", options: [{label: "10k", code: "VTT10", ...}] }]
  });

  useEffect(() => {
    if (isEdit) fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
    if (error) { toast.error(t('Lỗi tải sản phẩm', 'Error loading product')); return; }
    
    // Đảm bảo variants luôn là mảng
    let loadedVariants = data.variants;
    if (!Array.isArray(loadedVariants)) loadedVariants = [];

    // Map dữ liệu để đảm bảo các trường mới (code) tồn tại
    const cleanedVariants = loadedVariants.map(group => ({
        ...group,
        options: Array.isArray(group.options) ? group.options.map(opt => ({
            ...opt,
            label: opt.label || opt.value || '', // Ưu tiên label
            code: opt.code || '', // Load code cũ hoặc để trống
            price_mod: opt.price_mod || 0
        })) : []
    }));

    setProduct({
        ...data,
        allow_api_restock: data.allow_api_restock === true,
        variants: cleanedVariants
    });
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

  // --- QUẢN LÝ NHÓM BIẾN THỂ (Variant Groups) ---
  const addVariantGroup = () => {
      setProduct({
          ...product,
          variants: [...product.variants, { name: 'Phân loại', options: [] }]
      });
  };

  const removeVariantGroup = (idx) => {
      const newVars = [...product.variants];
      newVars.splice(idx, 1);
      setProduct({ ...product, variants: newVars });
  };

  const updateGroupName = (idx, val) => {
      const newVars = [...product.variants];
      newVars[idx].name = val;
      setProduct({ ...product, variants: newVars });
  };

  // --- QUẢN LÝ TÙY CHỌN (Options) ---
  const addOption = (groupIdx) => {
      const newVars = [...product.variants];
      newVars[groupIdx].options.push({ label: '', code: '', price_mod: 0 });
      setProduct({ ...product, variants: newVars });
  };

  const removeOption = (groupIdx, optIdx) => {
      const newVars = [...product.variants];
      newVars[groupIdx].options.splice(optIdx, 1);
      setProduct({ ...product, variants: newVars });
  };

  const updateOption = (groupIdx, optIdx, field, val) => {
      const newVars = [...product.variants];
      newVars[groupIdx].options[optIdx][field] = val;

      // Logic sinh mã tự động (chỉ khi đang nhập Label và chưa có Code hoặc chưa bật API)
      if (field === 'label') {
           const currentCode = newVars[groupIdx].options[optIdx].code;
           if (!currentCode || !product.allow_api_restock) {
                newVars[groupIdx].options[optIdx].code = generateSlug(val).toUpperCase();
           }
      }
      setProduct({ ...product, variants: newVars });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Chuẩn hóa dữ liệu trước khi lưu
    const finalVariants = product.variants.map(group => ({
        name: group.name || 'Phân loại',
        options: group.options.map(opt => ({
            label: opt.label,
            label_en: opt.label, // Sync EN
            value: opt.label,    // QUAN TRỌNG: Sync value = label để khớp bảng product_keys cũ
            price_mod: Number(opt.price_mod),
            code: opt.code || generateSlug(opt.label).toUpperCase(), // Đảm bảo luôn có SKU
            image: opt.image || ''
        }))
    }));

    const payload = { 
        ...product, 
        variants: finalVariants,
        allow_api_restock: product.allow_api_restock 
    };
    
    delete payload.id; 
    delete payload.created_at;
    delete payload.variants_config; // Xóa cột rác nếu có

    let error;
    if (isEdit) {
      ({ error } = await supabase.from('products').update(payload).eq('id', id));
    } else {
      ({ error } = await supabase.from('products').insert(payload));
    }

    setLoading(false);
    if (error) toast.error("Database Error: " + error.message);
    else {
        toast.success(t("Đã lưu sản phẩm!", "Product Saved!"));
        navigate('/admin/products');
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
            {/* CỘT TRÁI: THÔNG TIN CHÍNH */}
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

                    {/* CHECKBOX API */}
                    {product.is_digital && (
                        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex items-start gap-3 mt-2">
                             <input 
                                type="checkbox" 
                                id="apiCheck"
                                className="mt-1 w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                                checked={product.allow_api_restock}
                                onChange={e => setProduct({...product, allow_api_restock: e.target.checked})}
                            />
                            <div>
                                <label htmlFor="apiCheck" className="block text-sm font-bold text-indigo-900 cursor-pointer flex items-center gap-2">
                                    <Zap size={16} className="text-indigo-600"/>
                                    {t("Get Key over API if Out of Stock", "Get Key over API if Out of Stock")}
                                </label>
                                <p className="text-xs text-indigo-700 mt-1">
                                    {t(
                                        "Khi bật: Cho phép chỉnh sửa Mã SKU bên dưới để khớp với hệ thống API (Appota, Banthe247...).",
                                        "Enabled: Allows editing SKU Code below to match API providers."
                                    )}
                                </p>
                            </div>
                        </div>
                    )}
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">{t('Giá mặc định (VNĐ)', 'Default Price (VND)')}</label>
                        <input type="number" className="w-full border p-2 rounded-lg font-mono"
                            value={product.price} onChange={e=>setProduct({...product, price: Number(e.target.value)})}
                        />
                    </div>
                </div>

                {/* KHU VỰC QUẢN LÝ BIẾN THỂ (NESTED STRUCTURE) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <Layers size={18}/> {t('Các nhóm biến thể', 'Variant Groups')}
                        </h3>
                        <button type="button" onClick={addVariantGroup} className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded-lg hover:bg-blue-100 flex items-center gap-1 font-medium">
                            <Plus size={16}/> {t('Thêm nhóm', 'Add Group')}
                        </button>
                    </div>
                    
                    {product.variants.length === 0 ? (
                        <p className="text-sm text-slate-400 italic text-center py-6 border-2 border-dashed rounded-lg">
                            {t('Chưa có biến thể nào.', 'No variants added.')}
                        </p>
                    ) : (
                        product.variants.map((group, gIdx) => (
                            <div key={gIdx} className="border rounded-xl p-4 bg-slate-50 mb-4">
                                <div className="flex justify-between items-center mb-3">
                                    <input 
                                        className="font-bold text-slate-700 bg-transparent border-b border-slate-300 focus:border-blue-500 outline-none w-1/2"
                                        value={group.name}
                                        placeholder="Tên nhóm (VD: Mệnh giá)"
                                        onChange={e => updateGroupName(gIdx, e.target.value)}
                                    />
                                    <button type="button" onClick={() => removeVariantGroup(gIdx)} className="text-red-400 hover:text-red-600 text-xs uppercase font-bold">
                                        {t('Xóa nhóm', 'Remove Group')}
                                    </button>
                                </div>

                                {/* BẢNG OPTIONS */}
                                <div className="space-y-2">
                                    <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-500 uppercase px-2">
                                        <div className="col-span-4">Tên hiển thị</div>
                                        <div className="col-span-4 flex items-center gap-1">
                                            Mã SKU {product.allow_api_restock && <Zap size={10} className="text-indigo-600"/>}
                                        </div>
                                        <div className="col-span-3">Giá (+/-)</div>
                                        <div className="col-span-1"></div>
                                    </div>

                                    {group.options.map((opt, oIdx) => (
                                        <div key={oIdx} className="grid grid-cols-12 gap-2 items-center">
                                            <div className="col-span-4">
                                                <input 
                                                    className="w-full border p-1.5 rounded text-sm outline-none focus:border-blue-500"
                                                    placeholder="VD: 50k"
                                                    value={opt.label}
                                                    onChange={e => updateOption(gIdx, oIdx, 'label', e.target.value)}
                                                />
                                            </div>
                                            <div className="col-span-4">
                                                <input 
                                                    readOnly={!product.allow_api_restock}
                                                    className={`w-full border p-1.5 rounded text-sm font-mono outline-none 
                                                        ${product.allow_api_restock 
                                                            ? 'bg-white border-indigo-300 text-indigo-700 font-bold' 
                                                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                                                    placeholder="AUTO"
                                                    value={opt.code}
                                                    onChange={e => updateOption(gIdx, oIdx, 'code', e.target.value)}
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <input 
                                                    type="number"
                                                    className="w-full border p-1.5 rounded text-sm text-right outline-none focus:border-blue-500"
                                                    placeholder="0"
                                                    value={opt.price_mod}
                                                    onChange={e => updateOption(gIdx, oIdx, 'price_mod', e.target.value)}
                                                />
                                            </div>
                                            <div className="col-span-1 text-center">
                                                <button type="button" onClick={() => removeOption(gIdx, oIdx)} className="text-slate-400 hover:text-red-500">
                                                    <Trash2 size={16}/>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    <button type="button" onClick={() => addOption(gIdx)} className="text-xs text-blue-600 font-bold hover:underline mt-2 flex items-center gap-1">
                                        <Plus size={12}/> {t('Thêm tùy chọn', 'Add Option')}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* CỘT PHẢI: ẢNH & ACTION */}
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
                       {loading ? (
                           <span>{t('Đang lưu...', 'Saving...')}</span>
                       ) : (
                           <>
                               <Save size={18}/>
                               <span>{isEdit ? t('Cập nhật', 'Update') : t('Tạo mới', 'Create')}</span>
                           </>
                       )}
                   </button>
                </div>
            </div>
        </form>
    </div>
  );
}
