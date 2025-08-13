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
  paid_amount DECIMAL(12,2) DEFAULT 0.00,
  remaining_amount DECIMAL(12,2) DEFAULT 0.00,
  status VARCHAR(20) DEFAULT 'مسودة' CHECK (status IN ('مدفوعة', 'مدفوعة جزئياً', 'معلقة', 'متأخرة', 'مسودة', 'ملغاة')),
  date DATE DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  invoice_id VARCHAR(50) REFERENCES invoices(id) ON DELETE CASCADE,
  merchant_id BIGINT REFERENCES merchants(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(20) DEFAULT 'نقدي' CHECK (payment_method IN ('نقدي', 'تحويل بنكي', 'شيك', 'بطاقة ائتمان')),
  payment_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
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

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_merchant_id ON payments(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

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

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to update invoice amounts when payment is added/updated/deleted
CREATE OR REPLACE FUNCTION update_invoice_amounts()
RETURNS TRIGGER AS $$
BEGIN
    -- Update invoice amounts for the affected invoice
    IF TG_OP = 'DELETE' THEN
        UPDATE invoices
        SET
            paid_amount = (
                SELECT COALESCE(SUM(amount), 0)
                FROM payments
                WHERE invoice_id = OLD.invoice_id
            )
        WHERE id = OLD.invoice_id;

        -- Update remaining amount and status
        UPDATE invoices
        SET
            remaining_amount = amount - paid_amount,
            status = CASE
                WHEN paid_amount = 0 THEN 'معلقة'
                WHEN paid_amount >= amount THEN 'مدفوعة'
                ELSE 'مدفوعة جزئياً'
            END
        WHERE id = OLD.invoice_id;

        RETURN OLD;
    ELSE
        UPDATE invoices
        SET
            paid_amount = (
                SELECT COALESCE(SUM(amount), 0)
                FROM payments
                WHERE invoice_id = NEW.invoice_id
            )
        WHERE id = NEW.invoice_id;

        -- Update remaining amount and status
        UPDATE invoices
        SET
            remaining_amount = amount - paid_amount,
            status = CASE
                WHEN paid_amount = 0 THEN 'معلقة'
                WHEN paid_amount >= amount THEN 'مدفوعة'
                ELSE 'مدفوعة جزئياً'
            END
        WHERE id = NEW.invoice_id;

        RETURN NEW;
    END IF;
END;
$$ language 'plpgsql';

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

-- Create triggers to automatically update invoice amounts
CREATE TRIGGER update_invoice_amounts_on_insert
    AFTER INSERT ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_amounts();

CREATE TRIGGER update_invoice_amounts_on_update
    AFTER UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_amounts();

CREATE TRIGGER update_invoice_amounts_on_delete
    AFTER DELETE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_amounts();

-- Enable Row Level Security (RLS)
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for now - you can restrict later)
CREATE POLICY "Allow all operations on merchants" ON merchants
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on invoices" ON invoices
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on payments" ON payments
    FOR ALL USING (true) WITH CHECK (true);
