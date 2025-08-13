import { createClient } from '@supabase/supabase-js'

// Replace these with your actual Supabase project credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database Types
export interface Merchant {
  id: number
  name: string
  email: string
  phone: string
  address: string
  status: 'نشط' | 'معلق' | 'غير نشط'
  join_date: string
  total_invoices: number
  total_amount: number
  category: 'تجزئة' | 'جملة' | 'خدمات'
  created_at: string
  updated_at: string
}

export interface Invoice {
  id: string
  merchant_id: number
  merchant_name: string
  merchant_phone: string
  amount: number
  paid_amount: number
  remaining_amount: number
  status: 'مدفوعة' | 'مدفوعة جزئياً' | 'معلقة' | 'متأخرة' | 'مسودة' | 'ملغاة'
  date: string
  due_date: string
  items: InvoiceItem[]
  created_at: string
  updated_at: string
}

export interface Payment {
  id: number
  invoice_id: string
  merchant_id: number
  amount: number
  payment_method: 'نقدي' | 'تحويل بنكي' | 'شيك' | 'بطاقة ائتمان'
  payment_date: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface InvoiceItem {
  name: string
  quantity: number
  price: number
}

// Database functions
export const merchantsService = {
  // Get all merchants
  async getAll() {
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data as Merchant[]
  },

  // Get merchant by ID
  async getById(id: number) {
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data as Merchant
  },

  // Create new merchant
  async create(merchant: Omit<Merchant, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('merchants')
      .insert([merchant])
      .select()
      .single()
    
    if (error) throw error
    return data as Merchant
  },

  // Update merchant
  async update(id: number, updates: Partial<Merchant>) {
    const { data, error } = await supabase
      .from('merchants')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data as Merchant
  },

  // Delete merchant
  async delete(id: number) {
    const { error } = await supabase
      .from('merchants')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }
}

export const invoicesService = {
  // Get all invoices
  async getAll() {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Add default values for invoices that don't have the new fields
    const invoicesWithDefaults = data?.map(invoice => ({
      ...invoice,
      paid_amount: invoice.paid_amount || 0,
      remaining_amount: invoice.remaining_amount !== undefined ? invoice.remaining_amount : invoice.amount,
    })) || [];

    return invoicesWithDefaults as Invoice[]
  },

  // Get invoice by ID
  async getById(id: string) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    // Add default values if the fields don't exist
    const invoiceWithDefaults = {
      ...data,
      paid_amount: data.paid_amount || 0,
      remaining_amount: data.remaining_amount !== undefined ? data.remaining_amount : data.amount,
    };

    return invoiceWithDefaults as Invoice
  },

  // Create new invoice
  async create(invoice: Omit<Invoice, 'created_at' | 'updated_at'>) {
    const invoiceWithDefaults = {
      ...invoice,
      paid_amount: invoice.paid_amount || 0,
      remaining_amount: invoice.remaining_amount || invoice.amount,
    };

    const { data, error } = await supabase
      .from('invoices')
      .insert([invoiceWithDefaults])
      .select()
      .single()

    if (error) throw error
    return data as Invoice
  },

  // Update invoice
  async update(id: string, updates: Partial<Invoice>) {
    const { data, error } = await supabase
      .from('invoices')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data as Invoice
  },

  // Delete invoice
  async delete(id: string) {
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }
}
