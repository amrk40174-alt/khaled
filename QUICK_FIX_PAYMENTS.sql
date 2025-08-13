-- ========================================
-- إصلاح سريع لنظام المدفوعات
-- يرجى تشغيل هذا الكود في Supabase SQL Editor
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

-- 2. إضافة الأعمدة الجديدة للفواتير
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(12,2) DEFAULT 0.00;

-- 3. تحديث الفواتير الموجودة
UPDATE invoices 
SET 
    paid_amount = COALESCE(paid_amount, 0.00),
    remaining_amount = COALESCE(remaining_amount, amount)
WHERE paid_amount IS NULL OR remaining_amount IS NULL;

-- 4. إضافة Foreign Keys
ALTER TABLE payments 
ADD CONSTRAINT fk_payments_invoice 
FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;

ALTER TABLE payments 
ADD CONSTRAINT fk_payments_merchant 
FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE;

-- 5. إنشاء Indexes للأداء
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_merchant_id ON payments(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- 6. إنشاء دالة تحديث updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. إنشاء Trigger لتحديث updated_at
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at 
    BEFORE UPDATE ON payments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 8. تفعيل Row Level Security
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 9. إنشاء Policy للأمان
DROP POLICY IF EXISTS "Allow all operations on payments" ON payments;
CREATE POLICY "Allow all operations on payments" ON payments
    FOR ALL USING (true) WITH CHECK (true);

-- 10. إنشاء دالة تحديث مبالغ الفاتورة
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

-- 11. إنشاء Triggers لتحديث الفواتير تلقائياً
DROP TRIGGER IF EXISTS update_invoice_amounts_on_insert ON payments;
DROP TRIGGER IF EXISTS update_invoice_amounts_on_update ON payments;
DROP TRIGGER IF EXISTS update_invoice_amounts_on_delete ON payments;

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

-- 12. تحديث حالة الفواتير الموجودة بناءً على الحالة الحالية
UPDATE invoices 
SET 
    paid_amount = CASE WHEN status = 'مدفوعة' THEN amount ELSE 0 END,
    remaining_amount = CASE WHEN status = 'مدفوعة' THEN 0 ELSE amount END
WHERE status IN ('مدفوعة', 'معلقة', 'متأخرة');

-- 13. عرض ملخص النتائج
SELECT 
    'إجمالي الجداول' as description,
    COUNT(*) as count
FROM information_schema.tables 
WHERE table_name IN ('payments', 'invoices', 'merchants')
AND table_schema = 'public'

UNION ALL

SELECT 
    'إجمالي المدفوعات' as description,
    COUNT(*) as count
FROM payments

UNION ALL

SELECT 
    'إجمالي الفواتير' as description,
    COUNT(*) as count
FROM invoices;

-- انتهى الإعداد! 🎉
-- الآن يمكنك استخدام نظام المدفوعات
