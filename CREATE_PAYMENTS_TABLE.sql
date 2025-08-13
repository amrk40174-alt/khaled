-- ========================================
-- إنشاء جدول المدفوعات - نسخة مبسطة
-- انسخ هذا الكود والصقه في Supabase SQL Editor
-- ========================================

-- 1. إنشاء جدول المدفوعات
CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  invoice_id VARCHAR(50) NOT NULL,
  merchant_id BIGINT NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(20) DEFAULT 'نقدي' CHECK (payment_method IN ('نقدي', 'تحويل بنكي', 'شيك', 'بطاقة ائتمان')),
  payment_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. إضافة Foreign Keys
ALTER TABLE payments 
ADD CONSTRAINT fk_payments_invoice 
FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;

ALTER TABLE payments 
ADD CONSTRAINT fk_payments_merchant 
FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE;

-- 3. إضافة أعمدة جديدة للفواتير
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(12,2) DEFAULT 0.00;

-- 4. تحديث الفواتير الموجودة
UPDATE invoices 
SET 
    paid_amount = COALESCE(paid_amount, 0.00),
    remaining_amount = COALESCE(remaining_amount, amount)
WHERE paid_amount IS NULL OR remaining_amount IS NULL;

-- 5. إنشاء Indexes للأداء
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_merchant_id ON payments(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- 6. تفعيل Row Level Security
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 7. إنشاء Policy للأمان
CREATE POLICY "Allow all operations on payments" ON payments
    FOR ALL USING (true) WITH CHECK (true);

-- 8. إنشاء دالة تحديث الفواتير تلقائياً
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
            ),
            remaining_amount = amount - (
                SELECT COALESCE(SUM(amount), 0) 
                FROM payments 
                WHERE invoice_id = OLD.invoice_id
            )
        WHERE id = OLD.invoice_id;
        
        -- Update status based on payment
        UPDATE invoices 
        SET status = CASE 
            WHEN paid_amount = 0 THEN 'معلقة'
            WHEN paid_amount >= amount THEN 'مدفوعة'
            ELSE 'مدفوعة جزئياً'
        END
        WHERE id = OLD.invoice_id AND status NOT IN ('مسودة', 'ملغاة');
        
        RETURN OLD;
    ELSE
        UPDATE invoices 
        SET 
            paid_amount = (
                SELECT COALESCE(SUM(amount), 0) 
                FROM payments 
                WHERE invoice_id = NEW.invoice_id
            ),
            remaining_amount = amount - (
                SELECT COALESCE(SUM(amount), 0) 
                FROM payments 
                WHERE invoice_id = NEW.invoice_id
            )
        WHERE id = NEW.invoice_id;
        
        -- Update status based on payment
        UPDATE invoices 
        SET status = CASE 
            WHEN paid_amount = 0 THEN 'معلقة'
            WHEN paid_amount >= amount THEN 'مدفوعة'
            ELSE 'مدفوعة جزئياً'
        END
        WHERE id = NEW.invoice_id AND status NOT IN ('مسودة', 'ملغاة');
        
        RETURN NEW;
    END IF;
END;
$$ language 'plpgsql';

-- 9. إنشاء Triggers لتحديث الفواتير تلقائياً
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

-- 10. عرض ملخص النتائج
SELECT 
    'payments' as table_name,
    COUNT(*) as record_count
FROM payments

UNION ALL

SELECT 
    'invoices' as table_name,
    COUNT(*) as record_count
FROM invoices;

-- انتهى الإعداد! 🎉
-- الآن يمكنك استخدام نظام المدفوعات

-- للتأكد من نجاح الإعداد، شغل هذا الاستعلام:
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'payments';
