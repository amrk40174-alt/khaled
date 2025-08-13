-- تأكد من تشغيل هذا الكود في SQL Editor في Supabase

-- Create merchants table
CREATE TABLE IF NOT EXISTS merchants (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50) NOT NULL,
  address TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'نشط' CHECK (status IN ('نشط', 'معلق', 'غير نشط')),
  join_date DATE DEFAULT CURRENT_DATE,
  total_invoices INTEGER DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0.00,
  category VARCHAR(20) DEFAULT 'تجزئة' CHECK (category IN ('تجزئة', 'جملة', 'خدمات')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(50) PRIMARY KEY,
  merchant_id BIGINT REFERENCES merchants(id) ON DELETE CASCADE,
  merchant_name VARCHAR(255) NOT NULL,
  merchant_phone VARCHAR(50) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'مسودة' CHECK (status IN ('مدفوعة', 'معلقة', 'متأخرة', 'مسودة', 'ملغاة')),
  date DATE DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants(status);
CREATE INDEX IF NOT EXISTS idx_merchants_category ON merchants(category);
CREATE INDEX IF NOT EXISTS idx_merchants_created_at ON merchants(created_at);

CREATE INDEX IF NOT EXISTS idx_invoices_merchant_id ON invoices(merchant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for now)
CREATE POLICY "Allow all operations on merchants" ON merchants
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on invoices" ON invoices
    FOR ALL USING (true) WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_merchants_updated_at 
    BEFORE UPDATE ON merchants 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at 
    BEFORE UPDATE ON invoices 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to update merchant totals when invoice is added/updated/deleted
CREATE OR REPLACE FUNCTION update_merchant_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Update totals for the affected merchant
    IF TG_OP = 'DELETE' THEN
        UPDATE merchants 
        SET 
            total_invoices = (
                SELECT COUNT(*) 
                FROM invoices 
                WHERE merchant_id = OLD.merchant_id
            ),
            total_amount = (
                SELECT COALESCE(SUM(amount), 0) 
                FROM invoices 
                WHERE merchant_id = OLD.merchant_id AND status = 'مدفوعة'
            )
        WHERE id = OLD.merchant_id;
        RETURN OLD;
    ELSE
        UPDATE merchants 
        SET 
            total_invoices = (
                SELECT COUNT(*) 
                FROM invoices 
                WHERE merchant_id = NEW.merchant_id
            ),
            total_amount = (
                SELECT COALESCE(SUM(amount), 0) 
                FROM invoices 
                WHERE merchant_id = NEW.merchant_id AND status = 'مدفوعة'
            )
        WHERE id = NEW.merchant_id;
        RETURN NEW;
    END IF;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update merchant totals
CREATE TRIGGER update_merchant_totals_on_insert
    AFTER INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_merchant_totals();

CREATE TRIGGER update_merchant_totals_on_update
    AFTER UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_merchant_totals();

CREATE TRIGGER update_merchant_totals_on_delete
    AFTER DELETE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_merchant_totals();
