-- ========================================
-- إعداد قاعدة البيانات الكامل والنظيف
-- نسخ هذا الكود والصقه في Supabase SQL Editor
-- ========================================

-- 1. حذف الجداول والدوال الموجودة (إعادة تعيين نظيف)
DROP TABLE IF EXISTS payments CASCADE;
DROP FUNCTION IF EXISTS update_invoice_amounts() CASCADE;
DROP TRIGGER IF EXISTS update_invoice_amounts_on_insert ON payments;
DROP TRIGGER IF EXISTS update_invoice_amounts_on_update ON payments;
DROP TRIGGER IF EXISTS update_invoice_amounts_on_delete ON payments;

-- 2. إضافة أعمدة المدفوعات للفواتير إذا لم تكن موجودة
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(12,2) DEFAULT 0.00;

-- 3. تحديث الفواتير الموجودة
UPDATE invoices 
SET 
    paid_amount = 0.00,
    remaining_amount = amount
WHERE paid_amount IS NULL OR remaining_amount IS NULL;

-- 4. إنشاء جدول المدفوعات الجديد
CREATE TABLE payments (
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

-- 5. إضافة Foreign Keys
ALTER TABLE payments 
ADD CONSTRAINT fk_payments_invoice 
FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;

ALTER TABLE payments 
ADD CONSTRAINT fk_payments_merchant 
FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE;

-- 6. إنشاء Indexes للأداء
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_merchant_id ON payments(merchant_id);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_payments_created_at ON payments(created_at);

-- 7. تفعيل Row Level Security
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 8. إنشاء Policy للأمان
CREATE POLICY "Allow all operations on payments" ON payments
    FOR ALL USING (true) WITH CHECK (true);

-- 9. إنشاء دالة تحديث الفواتير (محسنة)
CREATE OR REPLACE FUNCTION update_invoice_amounts()
RETURNS TRIGGER AS $$
DECLARE
    invoice_record RECORD;
    total_paid DECIMAL(12,2);
    remaining DECIMAL(12,2);
    new_status VARCHAR(20);
BEGIN
    -- تحديد معرف الفاتورة
    IF TG_OP = 'DELETE' THEN
        -- في حالة الحذف، استخدم OLD
        SELECT * INTO invoice_record FROM invoices WHERE id = OLD.invoice_id;
        
        -- حساب إجمالي المدفوع بعد الحذف
        SELECT COALESCE(SUM(amount), 0) INTO total_paid 
        FROM payments 
        WHERE invoice_id = OLD.invoice_id;
        
    ELSE
        -- في حالة الإضافة أو التحديث، استخدم NEW
        SELECT * INTO invoice_record FROM invoices WHERE id = NEW.invoice_id;
        
        -- حساب إجمالي المدفوع
        SELECT COALESCE(SUM(amount), 0) INTO total_paid 
        FROM payments 
        WHERE invoice_id = NEW.invoice_id;
    END IF;
    
    -- التأكد من وجود الفاتورة
    IF invoice_record.id IS NULL THEN
        RAISE NOTICE 'Invoice not found: %', COALESCE(NEW.invoice_id, OLD.invoice_id);
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- حساب المبلغ المتبقي
    remaining := invoice_record.amount - total_paid;
    
    -- تحديد الحالة الجديدة
    IF total_paid = 0 THEN
        new_status := 'معلقة';
    ELSIF total_paid >= invoice_record.amount THEN
        new_status := 'مدفوعة';
        remaining := 0; -- التأكد من أن المتبقي صفر
    ELSE
        new_status := 'مدفوعة جزئياً';
    END IF;
    
    -- تحديث الفاتورة
    UPDATE invoices 
    SET 
        paid_amount = total_paid,
        remaining_amount = remaining,
        status = CASE 
            WHEN status IN ('مسودة', 'ملغاة') THEN status -- لا تغير هذه الحالات
            ELSE new_status
        END,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    -- طباعة معلومات للتتبع
    RAISE NOTICE 'Updated invoice %: paid=%, remaining=%, status=%', 
        COALESCE(NEW.invoice_id, OLD.invoice_id), total_paid, remaining, new_status;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 10. إنشاء Triggers
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

-- 11. إنشاء دالة لإعادة حساب جميع الفواتير
CREATE OR REPLACE FUNCTION recalculate_all_invoices()
RETURNS TEXT AS $$
DECLARE
    invoice_rec RECORD;
    total_paid DECIMAL(12,2);
    remaining DECIMAL(12,2);
    new_status VARCHAR(20);
    updated_count INTEGER := 0;
BEGIN
    -- تكرار عبر جميع الفواتير
    FOR invoice_rec IN SELECT * FROM invoices LOOP
        -- حساب إجمالي المدفوع لهذه الفاتورة
        SELECT COALESCE(SUM(amount), 0) INTO total_paid 
        FROM payments 
        WHERE invoice_id = invoice_rec.id;
        
        -- حساب المبلغ المتبقي
        remaining := invoice_rec.amount - total_paid;
        
        -- تحديد الحالة
        IF total_paid = 0 THEN
            new_status := 'معلقة';
        ELSIF total_paid >= invoice_rec.amount THEN
            new_status := 'مدفوعة';
            remaining := 0;
        ELSE
            new_status := 'مدفوعة جزئياً';
        END IF;
        
        -- تحديث الفاتورة
        UPDATE invoices 
        SET 
            paid_amount = total_paid,
            remaining_amount = remaining,
            status = CASE 
                WHEN status IN ('مسودة', 'ملغاة') THEN status
                ELSE new_status
            END,
            updated_at = NOW()
        WHERE id = invoice_rec.id;
        
        updated_count := updated_count + 1;
    END LOOP;
    
    RETURN 'تم تحديث ' || updated_count || ' فاتورة بنجاح';
END;
$$ LANGUAGE plpgsql;

-- 12. تشغيل إعادة الحساب لجميع الفواتير الموجودة
SELECT recalculate_all_invoices();

-- 13. إنشاء view للإحصائيات السريعة
CREATE OR REPLACE VIEW invoice_payment_summary AS
SELECT 
    i.id,
    i.merchant_id,
    i.amount as total_amount,
    COALESCE(i.paid_amount, 0) as paid_amount,
    COALESCE(i.remaining_amount, i.amount) as remaining_amount,
    i.status,
    COUNT(p.id) as payment_count,
    COALESCE(SUM(p.amount), 0) as calculated_paid
FROM invoices i
LEFT JOIN payments p ON i.id = p.invoice_id
GROUP BY i.id, i.merchant_id, i.amount, i.paid_amount, i.remaining_amount, i.status;

-- 14. إنشاء view لإحصائيات التجار
CREATE OR REPLACE VIEW merchant_payment_summary AS
SELECT 
    m.id,
    m.name,
    COUNT(i.id) as total_invoices,
    COALESCE(SUM(i.amount), 0) as total_amount,
    COALESCE(SUM(i.paid_amount), 0) as total_paid,
    COALESCE(SUM(i.remaining_amount), 0) as total_remaining,
    COUNT(CASE WHEN i.status = 'مدفوعة' THEN 1 END) as paid_invoices,
    COUNT(CASE WHEN i.status = 'مدفوعة جزئياً' THEN 1 END) as partial_invoices,
    COUNT(CASE WHEN i.status = 'معلقة' THEN 1 END) as pending_invoices
FROM merchants m
LEFT JOIN invoices i ON m.id = i.merchant_id
GROUP BY m.id, m.name;

-- 15. اختبار النظام
INSERT INTO payments (invoice_id, merchant_id, amount, payment_method, notes) 
SELECT 
    i.id,
    i.merchant_id,
    100.00,
    'نقدي',
    'دفعة تجريبية - سيتم حذفها'
FROM invoices i 
LIMIT 1;

-- حذف الدفعة التجريبية
DELETE FROM payments WHERE notes = 'دفعة تجريبية - سيتم حذفها';

-- 16. عرض النتائج للتأكد
SELECT 'إعداد قاعدة البيانات مكتمل!' as message;

SELECT 
    'الفواتير: ' || COUNT(*) as invoices_count
FROM invoices;

SELECT 
    'المدفوعات: ' || COUNT(*) as payments_count  
FROM payments;

SELECT 
    'التجار: ' || COUNT(*) as merchants_count
FROM merchants;

-- انتهى الإعداد! 🎉
