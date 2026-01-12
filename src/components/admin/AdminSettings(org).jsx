import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Upload, Key } from 'lucide-react';
import { toast } from 'react-toastify';
import { useLang } from '../../context/LangContext';

export default function AdminSettings() {
  const { t } = useLang();
  const [configs, setConfigs] = useState({});
  const [siteSettings, setSiteSettings] = useState({});
  
  useEffect(() => {
      fetchSettings();
  }, []);

  const fetchSettings = async () => {
      const { data: confData } = await supabase.from('app_config').select('*');
      const conf = {}; confData?.forEach(c => conf[c.key] = c.value);
      setConfigs(conf);
      
      const { data: siteData } = await supabase.from('site_settings').select('*');
      const site = {}; siteData?.forEach(s => site[s.key] = s.value);
      setSiteSettings(site);
  };

  const handleImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const fileName = `logo-${Date.now()}`;
      const { error } = await supabase.storage.from('product-images').upload(fileName, file);
      if(error) return toast.error(error.message);
      const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
      setSiteSettings({ ...siteSettings, site_logo_url: data.publicUrl });
      toast.success("Upload Logo thành công!");
  };

  const saveConfig = async (e) => { 
      e.preventDefault(); 
      try {
        for (const [key, value] of Object.entries(configs)) {
            await supabase.from('app_config').upsert({ key, value }); 
        }
        for (const [key, value] of Object.entries(siteSettings)) {
            await supabase.from('site_settings').upsert({ key, value, is_public: true }); 
        }
        toast.success(t("Đã lưu cấu hình!", "Configuration Saved!")); 
      } catch (err) { 
          toast.error("Lỗi: " + err.message); 
      }
  };

  return (
    <form onSubmit={saveConfig} className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-4xl mx-auto space-y-6 animate-fade-in">
       <h2 className="font-bold border-b pb-4 text-lg text-slate-800">System Configuration</h2>
       <div className="grid grid-cols-2 gap-6">
           <div><label className="block text-sm font-bold mb-2 text-slate-600">Logo</label><div className="flex gap-3 items-center"><label className="cursor-pointer bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition">Upload <input type="file" className="hidden" onChange={handleImageUpload}/></label>{siteSettings.site_logo_url && <img src={siteSettings.site_logo_url} className="h-10 border rounded bg-white p-1"/>}</div></div>
           <div><label className="block text-sm font-bold mb-2 text-slate-600">Shop Name</label><input className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={siteSettings.site_name||''} onChange={e=>setSiteSettings({...siteSettings,site_name:e.target.value})}/></div>
       </div>
       <div className="space-y-4">
           <div><label className="block text-sm font-bold mb-2 text-slate-600">Footer Text (VN)</label><textarea className="w-full border p-2.5 rounded-lg h-20 resize-none focus:ring-2 focus:ring-blue-500 outline-none" value={siteSettings.footer_text||''} onChange={e=>setSiteSettings({...siteSettings,footer_text:e.target.value})}/></div>
           <div><label className="block text-sm font-bold mb-2 text-slate-600">Footer Text (EN)</label><textarea className="w-full border p-2.5 rounded-lg h-20 resize-none focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" value={siteSettings.footer_text_en||''} onChange={e=>setSiteSettings({...siteSettings,footer_text_en:e.target.value})}/></div>
       </div>
       <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 space-y-4">
           <h3 className="font-bold text-blue-800">Contact Information</h3>
           <div className="grid grid-cols-2 gap-4">
               <div><label className="block text-xs font-bold uppercase mb-1">Email Support</label><input className="w-full border p-2 rounded-lg bg-white" value={siteSettings.contact_email||''} onChange={e=>setSiteSettings({...siteSettings,contact_email:e.target.value})}/></div>
               <div><label className="block text-xs font-bold uppercase mb-1">Hotline</label><input className="w-full border p-2 rounded-lg bg-white" value={siteSettings.contact_phone||''} onChange={e=>setSiteSettings({...siteSettings,contact_phone:e.target.value})}/></div>
           </div>
           <div className="grid grid-cols-3 gap-4">
               <div><label className="block text-xs font-bold uppercase mb-1">Address</label><input className="w-full border p-2 rounded-lg bg-white" value={siteSettings.contact_address||''} onChange={e=>setSiteSettings({...siteSettings,contact_address:e.target.value})}/></div>
               <div><label className="block text-xs font-bold uppercase mb-1">Zalo</label><input className="w-full border p-2 rounded-lg bg-white" value={siteSettings.contact_zalo||''} onChange={e=>setSiteSettings({...siteSettings,contact_zalo:e.target.value})}/></div>
               <div><label className="block text-xs font-bold uppercase mb-1">Telegram</label><input className="w-full border p-2 rounded-lg bg-white" value={siteSettings.contact_telegram||''} onChange={e=>setSiteSettings({...siteSettings,contact_telegram:e.target.value})}/></div>
           </div>
       </div>
       <div className="bg-red-50 p-5 rounded-xl border border-red-100">
           <h3 className="text-red-700 font-bold mb-3 flex items-center gap-2"><Key size={18}/> Private Keys (Server Only)</h3>
           <div className="space-y-3">
               <input className="w-full border p-2.5 rounded-lg bg-white font-mono text-sm" type="password" placeholder="Oxapay Merchant Key" value={configs.OXAPAY_MERCHANT_KEY||''} onChange={e=>setConfigs({...configs,OXAPAY_MERCHANT_KEY:e.target.value})}/>
               <div className="flex gap-3">
                   <input className="w-full border p-2.5 rounded-lg bg-white font-mono text-sm" type="password" placeholder="Telegram Bot Token" value={configs.TELEGRAM_BOT_TOKEN||''} onChange={e=>setConfigs({...configs,TELEGRAM_BOT_TOKEN:e.target.value})}/>
                   <input className="w-full border p-2.5 rounded-lg bg-white font-mono text-sm" placeholder="Chat ID" value={configs.TELEGRAM_CHAT_ID||''} onChange={e=>setConfigs({...configs,TELEGRAM_CHAT_ID:e.target.value})}/>
               </div>
           </div>
       </div>
       <div className="flex justify-end pt-4"><button className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-lg shadow-green-200">Save Configuration</button></div>
    </form>
  );
}
