import { createClient } from '@supabase/supabase-js'

// Vite sử dụng import.meta.env để đọc biến môi trường bắt đầu bằng VITE_
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Thiếu thông tin cấu hình Supabase trong file .env')
}

export const supabase = createClient(supabaseUrl, supabaseKey)