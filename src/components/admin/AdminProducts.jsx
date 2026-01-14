import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Package, Plus, Edit, X, Upload, Key, Layers, Settings, Image as ImageIcon, Trash2, Save, AlertCircle } from 'lucide-react';
import { useLang } from '../../context/LangContext';
import { toast } from 'react-toastify';
import { useQuery, useQueryClient } from '@tanstack/react-query'; 

export default function AdminProducts() {
  const { t, lang } = useLang(); 
  const queryClient = useQueryClient(); 
  
  // --- FETCH PRODUCTS ---
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('id', {ascending: false});
      if (error) throw error;
      return data;
    }
  });

  // --- MODAL STATES ---
  const [showProductModal, setShowProductModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(null); 
  
  // Form State
  const [productForm, setProductForm] = useState({
    id: null, title: '', title_en: '', price: '', 
    description: '', description_en: '', is_digital: true, 
    physical_stock: 0, images: [], 
    variants: [], 
    allow_external_key: false 
  });
  
  // State quản lý danh sách các biến thể chi tiết (SKUs)
  const [skuList, setSkuList] = useState([]); 

  const [keyInput, setKeyInput] = useState(''); 
  const [stockInput, setStockInput] = useState(0); 
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [skuUploading, setSkuUploading] = useState(null); // ID hoặc Index đang upload ảnh

  // --- LOGIC SINH MA TRẬN BIẾN THỂ (GENERATOR) ---
  useEffect(() => {
    if (!productForm.variants || productForm.variants.length === 0) {
        if (!productForm.id && skuList.length > 0) setSkuList([]); 
        return;
    }

    const generateCombinations = (groups, prefix = {}) => {
        if (!groups.length) return [prefix];
        const firstGroup = groups[0];
        const restGroups = groups.slice(1);
        let combinations = [];
        
        if(!firstGroup.options || firstGroup.options.length === 0) return generateCombinations(restGroups, prefix);
        
        firstGroup.options.forEach(opt => {
            if (opt.label) {
                combinations = combinations.concat(
                    generateCombinations(restGroups, { ...prefix, [firstGroup.name]: opt.label })
                );
            }
        });
        return combinations;
    };

    const validVariants = productForm.variants.filter(v => v.name && v.options.length > 0);
    
    if(validVariants.length > 0) {
        const combos = generateCombinations(validVariants);
        
        // Merge với skuList hiện tại để giữ lại stock/price/image đã nhập
        const mergedSkus = combos.map(combo => {
            const existing = skuList.find(s => JSON.stringify(s.options) === JSON.stringify(combo));
            
            if (existing) return existing;
            
            return {
                id: null,
                options: combo,
                sku_name: Object.values(combo).join(' - '),
                stock: 0,
                price_mod: 0,
                image: '', // Ảnh nằm ở tổ hợp cuối cùng
                is_active: true
            };
        });
        
        if (JSON.stringify(mergedSkus.map(s => s.options)) !== JSON.stringify(skuList.map(s => s.options))) {
             setSkuList(mergedSkus);
        }
    } else {
        setSkuList([]);
    }

  }, [productForm.variants]);

  // --- FETCH SKUs KHI EDIT ---
  const fetchSkus = async (productId) => {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId);
      if(!error && data) setSkuList(data);
  };

  // --- HANDLERS CHO CẤU HÌNH (SECTION 2) ---
  const addVariantGroup = () => setProductForm(prev => ({ ...prev, variants: [...(prev.variants || []), { name: '', options: [] }] }));
  
  const removeVariantGroup = (idx) => {
      setProductForm(prev => { 
          const n = [...prev.variants]; 
          n.splice(idx, 1); 
          return { ...prev, variants: n }; 
      });
  };

  const updateVariantName = (idx, val) => setProductForm(prev => { const n = [...prev.variants]; n[idx].name = val; return { ...prev, variants: n }; });
  
  const addOptionToGroup = (idx) => setProductForm(prev => { 
      const n = [...prev.variants]; 
      n[idx].options.push({ label: '', label_en: '' }); // Chỉ còn Label, không còn Price/Image ở đây
      return { ...prev, variants: n }; 
  });
  
  const removeOptionFromGroup = (gIdx, oIdx) => setProductForm(prev => { const n = [...prev.variants]; n[gIdx].options.splice(oIdx, 1); return { ...prev, variants: n }; });
  
  const updateOption = (gIdx, oIdx, field, val) => setProductForm(prev => { const n = [...prev.variants]; n[gIdx].options[oIdx][field] = val; return { ...prev, variants: n }; });

  // --- HANDLERS CHO SKU LIST (SECTION 3) ---
  const updateSkuField = (index, field, value) => {
      const newSkus = [...skuList];
      newSkus[index][field] = value;
      setSkuList(newSkus);
  };

  const handleSkuImageUpload = async (e, index) => {
      const file = e.target.files[0];
      if (!file) return;
      setSkuUploading(index);
      try {
          const fileName = `sku-${Date.now()}`;
          const { error } = await supabase.storage.from('product-images').upload(fileName, file);
          if(error) throw error;
          const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
          
          updateSkuField(index, 'image', data.publicUrl);
          toast.success(t("Đã tải ảnh biến thể!", "Variant image uploaded!"));
      } catch (err) { 
          toast.error(err.message); 
      } finally { 
          setSkuUploading(null); 
      }
  };

  // --- BASIC HANDLERS ---
  const handleImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploading(true);
      try {
          const fileName = `prod-${Date.now()}`;
          const { error } = await supabase.storage.from('product-images').upload(fileName, file);
          if(error) throw error;
          const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
          setProductForm(prev => ({ ...prev, images: [...(prev.images || []), data.publicUrl] }));
          toast.success(t("Đã tải ảnh chung!", "Product image uploaded!"));
      } catch (err) { toast.error(err.message); } finally { setUploading(false); }
  };
  
  const handleRemoveImage = (idx) => setProductForm(prev => ({...prev, images: prev.images.filter((_, i) => i !== idx)}));

  const openAddModal = () => {
      setProductForm({ 
        id: null, title: '', title_en: '', price: '', 
        description: '', description_en: '', is_digital: true, 
        physical_stock: 0, images: [], variants: [], allow_external_key: false 
      });
      setSkuList([]);
      setShowProductModal(true);
  };

  const openEditModal = async (p) => {
      setProductForm({
        id: p.id, title: p.title, title_en: p.title_en || '', price: p.price,
        description: p.description || '', description_en: p.description_en || '',
        is_digital: p.is_digital, 
        physical_stock: p.physical_stock || 0, 
        images: p.images || [], 
        variants: p.variants || [],
        allow_external_key: p.allow_external_key || false
      });
      
      if (p.variants && p.variants.length > 0) {
          await fetchSkus(p.id);
      } else {
          setSkuList([]);
      }
      setShowProductModal(true);
  };

  // --- SAVE PRODUCT ---
  const handleSaveProduct = async (e) => {
      e.preventDefault();
      setProcessing(true);
      
      try {
          // 1. Save Products table
          const productData = {
              title: productForm.title, title_en: productForm.title_en,
              price: parseFloat(productForm.price) || 0,
              description: productForm.description, description_en: productForm.description_en,
              images: productForm.images, is_digital: productForm.is_digital,
              variants: productForm.variants, 
              allow_external_key: productForm.allow_external_key
          };
          
          if (!productForm.variants || productForm.variants.length === 0) {
              productData.physical_stock = parseInt(productForm.physical_stock) || 0;
          }

          let productId = productForm.id;

          if (productId) {
              const { error } = await supabase.from('products').update(productData).eq('id', productId);
              if (error) throw error;
          } else {
              const { data, error } = await supabase.from('products').insert(productData).select().single();
              if (error) throw error;
              productId = data.id;
          }

          // 2. Save Variants table
          if (productForm.variants && productForm.variants.length > 0 && skuList.length > 0) {
               // A. Cleanup old variants
               const { data: existingVariants } = await supabase.from('product_variants').select('id').eq('product_id', productId);
               const existingIds = existingVariants?.map(v => v.id) || [];
               
               const currentUiIds = skuList.map(s => s.id).filter(id => id !== null);
               const idsToDelete = existingIds.filter(id => !currentUiIds.includes(id));

               if (idsToDelete.length > 0) {
                   await supabase.from('product_variants').delete().in('id', idsToDelete);
               }

               // B. Upsert
               const upsertData = skuList.map(sku => ({
                   id: sku.id, 
                   product_id: productId,
                   options: sku.options,
                   sku_name: Object.values(sku.options).join(' - '),
                   price_mod: parseFloat(sku.price_mod) || 0, // Lưu giá chênh lệch
                   stock: parseInt(sku.stock) || 0,
                   image: sku.image, // Lưu ảnh của variant
                   is_active: true
               }));

               const { error: upsertError } = await supabase.from('product_variants').upsert(upsertData);
               if (upsertError) throw upsertError;
          }

          setShowProductModal(false);
          queryClient.invalidateQueries({ queryKey: ['admin-products'] });
          toast.success(t("Đã lưu sản phẩm thành công!", "Product saved successfully!"));

      } catch (err) { 
          console.error(err);
          toast.error(t("Lỗi: ", "Error: ") + err.message); 
      } finally {
          setProcessing(false);
      }
  };

  // --- IMPORT KEY / STOCK ---
  const handleImportStock = async () => {
    try {
        if (!showKeyModal?.product) return;
        const currentProd = showKeyModal.product;
        const targetSku = showKeyModal.sku; 
        
        if (currentProd.is_digital) {
            if (!keyInput.trim()) return;
            const codes = keyInput.split('\n').filter(c => c.trim() !== '');
            
            let variantInfo = targetSku ? { ...targetSku.options } : {};
            const fullTitle = targetSku 
                ? `${currentProd.title} (${Object.values(targetSku.options).join(' - ')})`
                : currentProd.title;
            
            variantInfo._product_name = currentProd.title;
            variantInfo._full_title = fullTitle;

            const insertData = codes.map(code => ({ 
                product_id: currentProd.id, 
                key_value: code.trim(),
                variant_info: variantInfo, 
                is_used: false 
            }));

            const { error } = await supabase.from('product_keys').insert(insertData);
            if (error) throw error;
            
            toast.success(t(`Đã thêm ${insertData.length} Keys!`, `Added ${insertData.length} Keys!`));

            if (targetSku && targetSku.id) {
                 // Logic cộng dồn tạm thời trên UI
                 const newStock = (parseInt(targetSku.stock) || 0) + insertData.length;
                 await supabase.from('product_variants').update({stock: newStock}).eq('id', targetSku.id);
                 
                 const skuIndex = skuList.findIndex(s => s.id === targetSku.id);
                 if (skuIndex >= 0) updateSkuField(skuIndex, 'stock', newStock);
            }

        } else {
            const qtyToAdd = parseInt(stockInput);
            if (isNaN(qtyToAdd) || qtyToAdd <= 0) return toast.warn(t("Số lượng phải lớn hơn 0", "Quantity must be > 0"));

            if (targetSku) {
                const newStock = (parseInt(targetSku.stock) || 0) + qtyToAdd;
                
                const { error } = await supabase.from('product_variants')
                    .update({ stock: newStock })
                    .eq('id', targetSku.id);
                if (error) throw error;

                const skuIndex = skuList.findIndex(s => s.id === targetSku.id);
                if (skuIndex >= 0) updateSkuField(skuIndex, 'stock', newStock);

            } else {
                const { data: latest } = await supabase.from('products').select('physical_stock').eq('id', currentProd.id).single();
                const newStock = (latest.physical_stock || 0) + qtyToAdd;
                await supabase.from('products').update({ physical_stock: newStock }).eq('id', currentProd.id);
            }
            toast.success(t("Đã cập nhật kho!", "Stock updated!"));
        }

        setKeyInput(''); setStockInput(0); setShowKeyModal(null);
        queryClient.invalidateQueries({ queryKey: ['admin-products'] });

    } catch (err) { toast.error(t("Lỗi: ", "Error: ") + err.message); }
  };


  if (isLoading) return <div className="p-8 text-center">{t('Đang tải kho...', 'Loading Inventory...')}</div>;

  return (
    <div className="animate-fade-in pb-20">
       <div className="flex justify-between mb-6 items-center">
         <div>
            <h2 className="text-2xl font-bold text-slate-800">{t('Kho Sản Phẩm & Biến Thể', 'Product & Variants')}</h2>
            <p className="text-sm text-slate-500">{t('Quản lý sản phẩm, thiết lập biến thể cha-con và tồn kho chi tiết.', 'Manage products, variants and inventory.')}</p>
         </div>
         <button onClick={openAddModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow hover:bg-blue-700 transition"><Plus size={18}/> {t('Thêm Mới', 'Add New')}</button>
       </div>
       
       {/* PRODUCT LIST TABLE */}
       <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
         <table className="w-full text-left">
           <thead className="bg-slate-50 border-b text-slate-500 text-xs uppercase font-bold tracking-wider">
               <tr>
                   <th className="p-4">{t('Sản phẩm', 'Product')}</th>
                   <th className="p-4">{t('Cấu hình', 'Config')}</th>
                   <th className="p-4">{t('Tồn kho', 'Stock')}</th>
                   <th className="p-4 text-right">{t('Thao tác', 'Action')}</th>
               </tr>
           </thead>
           <tbody className="divide-y divide-slate-100">
             {products.map(p => {
               const hasVariants = p.variants && p.variants.length > 0;
               return (
               <tr key={p.id} className="hover:bg-slate-50 transition">
                 <td className="p-4 flex gap-3 items-center">
                    <div className="w-12 h-12 rounded bg-slate-100 border flex-shrink-0 overflow-hidden">
                        <img src={p.images?.[0] || 'https://via.placeholder.com/50'} className="w-full h-full object-cover"/>
                    </div> 
                    <div>
                        <span className="font-bold text-slate-700 block text-base">{p.title}</span>
                        {p.title_en && <span className="text-xs text-slate-400 block">{p.title_en}</span>}
                        <div className="flex gap-2 mt-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded border ${p.is_digital ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                                {p.is_digital ? 'Digital Key' : 'Physical'}
                            </span>
                        </div>
                    </div>
                 </td>
                 <td className="p-4">
                     {hasVariants ? (
                         <div className="space-y-1">
                             {p.variants.map((v, i) => (
                                 <div key={i} className="text-xs text-slate-600 flex items-center gap-1">
                                     <span className="font-bold bg-slate-200 px-1 rounded text-[10px]">{v.name}</span>
                                     <span className="text-slate-400">→</span>
                                     <span>{v.options?.map(o=>o.label).join(', ')}</span>
                                 </div>
                             ))}
                         </div>
                     ) : (
                         <span className="text-sm text-slate-400 italic">{t('Không có biến thể', 'No variants')}</span>
                     )}
                 </td>
                 <td className="p-4">
                     <span className="font-mono font-bold text-lg text-slate-700">
                        {hasVariants ? t('Xem chi tiết', 'Check Detail') : (p.physical_stock || 0)}
                     </span>
                 </td>
                 <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                        {!hasVariants && (
                             <button onClick={()=>setShowKeyModal({product: p, variant: null})} className="p-2 bg-green-50 text-green-600 rounded hover:bg-green-100" title={t("Nhập kho/Key", "Add Stock/Key")}>
                                 <Plus size={16}/>
                             </button>
                        )}
                        <button onClick={()=>openEditModal(p)} className="p-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100" title={t("Sửa", "Edit")}>
                            <Edit size={16}/>
                        </button>
                    </div>
                 </td>
               </tr>
             )})}
           </tbody>
         </table>
       </div>

       {/* --- MODAL EDIT/ADD PRODUCT --- */}
       {showProductModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-8 flex flex-col max-h-[90vh]">
              {/* HEADER */}
              <div className="p-6 border-b flex justify-between items-center bg-white sticky top-0 z-10 rounded-t-2xl">
                  <div>
                      <h2 className="text-xl font-bold text-slate-800">
                          {productForm.id ? t('Chi tiết sản phẩm', 'Product Details') : t('Thêm sản phẩm mới', 'Add New Product')}
                      </h2>
                      <p className="text-xs text-slate-400">{t('Thiết lập thông tin chung và cấu hình biến thể', 'Setup general info and variant configuration')}</p>
                  </div>
                  <button onClick={() => setShowProductModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition"><X size={20}/></button>
              </div>

              {/* BODY - SCROLLABLE */}
              <div className="p-6 overflow-y-auto flex-1 space-y-8">
                 
                 {/* 1. THÔNG TIN CƠ BẢN */}
                 <section>
                     <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-l-4 border-blue-500 pl-3">{t('1. Thông tin chung', '1. General Info')}</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('Tên sản phẩm (VN)', 'Product Name (VN)')} <span className="text-red-500">*</span></label>
                                <input required className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" value={productForm.title} onChange={e=>setProductForm({...productForm, title: e.target.value})}/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('Giá cơ bản ($ USDT)', 'Base Price ($ USDT)')} <span className="text-red-500">*</span></label>
                                <input type="number" step="0.01" required className="w-full border border-slate-300 p-2.5 rounded-lg font-mono text-green-600 font-bold focus:ring-2 focus:ring-blue-500 outline-none" value={productForm.price} onChange={e=>setProductForm({...productForm, price: e.target.value})}/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('Loại sản phẩm', 'Product Type')}</label>
                                <div className="flex gap-4">
                                    <label className={`flex-1 border p-3 rounded-lg cursor-pointer flex items-center gap-2 transition ${productForm.is_digital ? 'bg-purple-50 border-purple-200 text-purple-700' : 'hover:bg-slate-50'}`}>
                                        <input type="radio" name="type" checked={productForm.is_digital} onChange={()=>setProductForm({...productForm, is_digital: true})} className="w-4 h-4 text-purple-600"/>
                                        <Key size={18}/>
                                        <span className="font-bold">Digital (Key/File)</span>
                                    </label>
                                    <label className={`flex-1 border p-3 rounded-lg cursor-pointer flex items-center gap-2 transition ${!productForm.is_digital ? 'bg-orange-50 border-orange-200 text-orange-700' : 'hover:bg-slate-50'}`}>
                                        <input type="radio" name="type" checked={!productForm.is_digital} onChange={()=>setProductForm({...productForm, is_digital: false})} className="w-4 h-4 text-orange-600"/>
                                        <Package size={18}/>
                                        <span className="font-bold">{t('Vật lý (Ship)', 'Physical (Ship)')}</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('Tên tiếng Anh (Optional)', 'English Name (Optional)')}</label>
                                <input className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" value={productForm.title_en} onChange={e=>setProductForm({...productForm, title_en: e.target.value})}/>
                            </div>
                            
                            {/* FIX: Tách 2 ô mô tả */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('Mô tả (VN)', 'Desc (VN)')}</label>
                                    <textarea className="w-full border border-slate-300 p-2.5 rounded-lg h-24 resize-none focus:ring-2 focus:ring-blue-500 outline-none" value={productForm.description} onChange={e=>setProductForm({...productForm, description: e.target.value})}></textarea>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('Mô tả (EN)', 'Desc (EN)')}</label>
                                    <textarea className="w-full border border-slate-300 p-2.5 rounded-lg h-24 resize-none focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" value={productForm.description_en} onChange={e=>setProductForm({...productForm, description_en: e.target.value})}></textarea>
                                </div>
                            </div>

                             <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('Hình ảnh chung', 'General Images')}</label>
                                <div className="flex flex-wrap gap-2">
                                    {productForm.images?.map((img, idx) => (
                                        <div key={idx} className="relative w-16 h-16 border rounded overflow-hidden group">
                                            <img src={img} className="w-full h-full object-cover"/>
                                            <button type="button" onClick={() => handleRemoveImage(idx)} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition"><X size={10}/></button>
                                        </div>
                                    ))}
                                    <label className="w-16 h-16 border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:bg-slate-50">
                                        {uploading ? <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div> : <Upload size={16} className="text-slate-400"/>}
                                        <input type="file" className="hidden" onChange={handleImageUpload} disabled={uploading}/>
                                    </label>
                                </div>
                            </div>
                        </div>
                     </div>
                 </section>

                 {/* 2. CẤU HÌNH BIẾN THỂ (DEFINITION) */}
                 <section>
                    <div className="flex justify-between items-center mb-4 border-l-4 border-purple-500 pl-3">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">{t('2. Cấu hình biến thể (Options)', '2. Variant Options')}</h3>
                        <button type="button" onClick={addVariantGroup} className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-purple-700 transition flex items-center gap-1">
                            <Plus size={14}/> {t('Thêm nhóm (VD: Size)', 'Add Group')}
                        </button>
                    </div>

                    <div className="space-y-4 bg-slate-50 p-6 rounded-xl border border-slate-200">
                        {productForm.variants.length === 0 && (
                            <div className="text-center text-slate-400 text-sm py-4">{t('Sản phẩm chưa có biến thể (Sản phẩm đơn).', 'Product has no variants (Single product).')}</div>
                        )}
                        
                        {productForm.variants.map((group, gIdx) => (
                            <div key={gIdx} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm relative group animate-fade-in">
                                <button type="button" onClick={() => removeVariantGroup(gIdx)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition"><X size={16}/></button>
                                
                                <div className="grid grid-cols-12 gap-4">
                                    <div className="col-span-3">
                                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t('Tên nhóm', 'Group Name')}</label>
                                        <input type="text" placeholder="Ví dụ: Size..." className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-purple-500 outline-none" value={group.name} onChange={(e) => updateVariantName(gIdx, e.target.value)} />
                                    </div>
                                    <div className="col-span-9">
                                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t('Các lựa chọn (VN / EN)', 'Options (VN / EN)')}</label>
                                        <div className="flex flex-wrap gap-2">
                                            {group.options.map((opt, oIdx) => (
                                                <div key={oIdx} className="flex items-center gap-1 bg-slate-100 pl-2 pr-1 py-1 rounded border border-slate-200">
                                                    <input placeholder="VN" className="bg-transparent w-16 text-sm outline-none font-medium text-slate-700" value={opt.label} onChange={e => updateOption(gIdx, oIdx, 'label', e.target.value)} />
                                                    <div className="w-px h-3 bg-slate-300"></div>
                                                    <input placeholder="EN" className="bg-transparent w-16 text-sm outline-none font-light text-slate-500" value={opt.label_en} onChange={e => updateOption(gIdx, oIdx, 'label_en', e.target.value)} />
                                                    <button type="button" onClick={() => removeOptionFromGroup(gIdx, oIdx)} className="text-slate-400 hover:text-red-500 ml-1"><X size={14}/></button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => addOptionToGroup(gIdx)} className="px-2 py-1 text-xs bg-blue-50 text-blue-600 font-bold rounded hover:bg-blue-100">{t('+ Thêm', '+ Add')}</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                 </section>

                 {/* 3. MA TRẬN SKU (SKU MATRIX) */}
                 {productForm.variants.length > 0 && skuList.length > 0 && (
                     <section>
                         <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-l-4 border-green-500 pl-3">{t('3. Chi tiết biến thể & Ảnh (SKU Matrix)', '3. Variant Details & Images')}</h3>
                         <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                             <table className="w-full text-sm text-left bg-white">
                                 <thead className="bg-slate-100 text-xs uppercase text-slate-500 font-bold">
                                     <tr>
                                         <th className="p-4">{t('Biến thể', 'Variant')}</th>
                                         <th className="p-4 w-32 text-center">{t('Hình ảnh', 'Image')}</th>
                                         <th className="p-4 w-40">{t('Giá (+/-)', 'Price (+/-)')}</th>
                                         <th className="p-4 w-32 text-center">{t('Tồn kho', 'Stock')}</th>
                                         <th className="p-4 w-24">{t('Thao tác', 'Action')}</th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-100">
                                     {skuList.map((sku, idx) => (
                                         <tr key={idx} className="hover:bg-slate-50">
                                             <td className="p-4">
                                                 <div className="font-bold text-slate-700">{sku.sku_name}</div>
                                                 <div className="text-xs text-slate-400 mt-0.5">
                                                     {Object.entries(sku.options).map(([k,v]) => `${k}: ${v}`).join(' / ')}
                                                 </div>
                                             </td>
                                             <td className="p-4 text-center">
                                                 <div className="relative w-12 h-12 mx-auto border rounded bg-slate-50 flex items-center justify-center cursor-pointer group overflow-hidden">
                                                     {sku.image ? (
                                                         <img src={sku.image} className="w-full h-full object-cover"/>
                                                     ) : (
                                                         <ImageIcon size={20} className="text-slate-300"/>
                                                     )}
                                                     <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                                         {skuUploading === idx ? <div className="animate-spin w-4 h-4 border border-white rounded-full border-t-transparent"></div> : <Upload size={16} className="text-white"/>}
                                                         <input type="file" className="hidden" accept="image/*" onChange={(e) => handleSkuImageUpload(e, idx)} disabled={skuUploading !== null}/>
                                                     </label>
                                                 </div>
                                             </td>
                                             <td className="p-4">
                                                 <div className="flex items-center border rounded-lg px-2 bg-white">
                                                     <span className="text-slate-400 font-bold mr-1">$</span>
                                                     <input type="number" step="0.01" className="w-full py-2 outline-none font-mono text-sm" placeholder="0" value={sku.price_mod} onChange={(e) => updateSkuField(idx, 'price_mod', e.target.value)}/>
                                                 </div>
                                             </td>
                                             <td className="p-4 text-center">
                                                 <div className={`font-bold ${sku.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>{sku.stock}</div>
                                             </td>
                                             <td className="p-4">
                                                 <button type="button" onClick={() => setShowKeyModal({product: productForm, sku: sku})} className="p-2 bg-slate-100 hover:bg-slate-800 hover:text-white rounded-lg transition" title={t("Nhập hàng", "Add Stock")}>
                                                     {productForm.is_digital ? <Key size={16}/> : <Package size={16}/>}
                                                 </button>
                                             </td>
                                         </tr>
                                     ))}
                                 </tbody>
                             </table>
                         </div>
                     </section>
                 )}

                 {/* 4. STOCK & KEY CHO SẢN PHẨM ĐƠN */}
                 {(!productForm.variants || productForm.variants.length === 0) && (
                     <section className="bg-slate-50 p-6 rounded-xl border border-slate-200 flex justify-between items-center">
                         <div>
                             <h3 className="font-bold text-slate-800">{t('Quản lý kho (Sản phẩm đơn)', 'Inventory (Single Product)')}</h3>
                             <p className="text-sm text-slate-500">{t('Sản phẩm không có biến thể.', 'Product has no variants.')}</p>
                         </div>
                         <div className="flex items-center gap-4">
                             <div className="text-right">
                                 <span className="block text-xs text-slate-500 uppercase font-bold">{t('Hiện có', 'Available')}</span>
                                 <span className="text-2xl font-bold text-slate-800">{productForm.physical_stock}</span>
                             </div>
                             <button type="button" onClick={() => {
                                 if(!productForm.id) return toast.warn(t("Vui lòng lưu sản phẩm trước!", "Please save product first!"));
                                 setShowKeyModal({product: productForm, sku: null});
                             }} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-900 transition flex items-center gap-2">
                                 {productForm.is_digital ? <Key size={18}/> : <Package size={18}/>} {t('Nhập kho', 'Import Stock')}
                             </button>
                         </div>
                     </section>
                 )}

              </div>

              {/* FOOTER ACTIONS */}
              <div className="p-6 border-t bg-slate-50 rounded-b-2xl flex justify-end gap-3 sticky bottom-0 z-10">
                  <button type="button" onClick={() => setShowProductModal(false)} className="px-6 py-2.5 text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg font-bold transition">{t('Hủy bỏ', 'Cancel')}</button>
                  <button type="button" onClick={handleSaveProduct} disabled={processing} className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg hover:shadow-blue-500/30 transition flex items-center gap-2">
                      {processing ? t('Đang lưu...', 'Saving...') : <><Save size={18}/> {t('Lưu sản phẩm', 'Save Product')}</>}
                  </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL IMPORT STOCK / KEY */}
      {showKeyModal && (
         <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
               <h3 className="font-bold mb-4 text-lg text-slate-800 flex items-center gap-2">
                   {showKeyModal.product.is_digital ? <Key className="text-blue-600"/> : <Layers className="text-orange-600"/>}
                   {showKeyModal.product.is_digital ? t('Nhập Keys', 'Import Keys') : t('Thêm tồn kho', 'Add Stock')}
               </h3>
               
               {showKeyModal.sku && (
                   <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                       <span className="text-xs font-bold text-blue-500 uppercase block mb-1">{t('Đang nhập cho:', 'Importing for:')}</span>
                       <span className="font-bold text-blue-900">{showKeyModal.sku.sku_name}</span>
                   </div>
               )}

               {showKeyModal.product.is_digital ? (
                   <div>
                       <p className="text-xs text-slate-500 mb-2 font-medium uppercase">{t('Danh sách Key (Mỗi dòng 1 key)', 'Key List (One per line)')}</p>
                       <textarea className="w-full border p-3 h-48 rounded-xl font-mono text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none" value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="AAAA-BBBB-CCCC&#10;XXXX-YYYY-ZZZZ"></textarea>
                   </div>
               ) : (
                   <div className="bg-orange-50 p-6 rounded-xl border border-orange-100 text-center">
                       <label className="block text-orange-800 font-bold mb-2">{t('Số lượng thêm vào', 'Quantity to add')}</label>
                       <input type="number" className="w-32 border-2 border-orange-200 p-2 rounded-lg text-center font-bold text-3xl focus:border-orange-500 outline-none" value={stockInput} onChange={e => setStockInput(e.target.value)}/>
                   </div>
               )}
               <div className="flex justify-end gap-2 mt-6">
                   <button onClick={() => setShowKeyModal(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-medium transition">{t('Đóng', 'Close')}</button>
                   <button onClick={handleImportStock} className="px-6 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 shadow transition">{t('Xác nhận', 'Confirm')}</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
