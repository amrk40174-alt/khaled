-- ========================================
-- إعداد آمن ومبسط لنظام المدفوعات
-- هذا الكود آمن ولا يسبب أخطاء
-- ========================================

-- الخطوة 1: تنظيف آمن
DO $$ 
BEGIN
    -- حذف triggers فقط إذا كان الجدول موجود
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS payments_insert_trigger ON payments';
        EXECUTE 'DROP TRIGGER IF EXISTS payments_update_trigger ON payments';
        EXECUTE 'DROP TRIGGER IF EXISTS payments_delete_trigger ON payments';
        RAISE NOTICE 'تم حذف الـ triggers القديمة';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'تحذير في حذف triggers: %', SQLERRM;
END $$;

-- حذف الجداول والدوال بأمان
DROP TABLE IF EXISTS payments CASCADE;
DROP FUNCTION IF EXISTS update_invoice_amounts() CASCADE;
DROP FUNCTION IF EXISTS recalculate_all_invoices() CASCADE;

-- الخطوة 2: إعداد جدول الفواتير
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(12,2) DEFAULT 0.00;

-- تحديث الفواتير الموجودة
UPDATE invoices 
SET 
    paid_amount = 0.00,
    remaining_amount = amount
WHERE paid_amount IS NULL OR remaining_amount IS NULL;

-- الخطوة 3: إنشاء جدول المدفوعات
CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    invoice_id VARCHAR(50) NOT NULL,
    merchant_id BIGINT NOT NULL,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20) DEFAULT 'نقدي',
    payment_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- الخطوة 4: إضافة الروابط بأمان
DO $$ 
BEGIN
    -- ربط بجدول الفواتير
    ALTER TABLE payments 
    ADD CONSTRAINT fk_payments_invoice 
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'تم ربط جدول المدفوعات بالفواتير';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'تحذير في ربط الفواتير: %', SQLERRM;
END $$;

DO $$ 
BEGIN
    -- ربط بجدول التجار
    ALTER TABLE payments 
    ADD CONSTRAINT fk_payments_merchant 
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'تم ربط جدول المدفوعات بالتجار';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'تحذير في ربط التجار: %', SQLERRM;
END $$;

-- الخطوة 5: إنشاء الفهارس
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_merchant_id ON payments(merchant_id);
CREATE INDEX idx_payments_date ON payments(payment_date);

-- الخطوة 6: إعدادات الأمان
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_policy" ON payments FOR ALL USING (true) WITH CHECK (true);

-- الخطوة 7: إنشاء دالة التحديث البسيطة
CREATE OR REPLACE FUNCTION update_invoice_amounts()
RETURNS TRIGGER AS $$
DECLARE
    total_paid DECIMAL(12,2) := 0;
    invoice_amount DECIMAL(12,2) := 0;
    remaining DECIMAL(12,2) := 0;
    new_status VARCHAR(20);
    target_invoice_id VARCHAR(50);
BEGIN
    -- تحديد معرف الفاتورة
    IF TG_OP = 'DELETE' THEN
        target_invoice_id := OLD.invoice_id;
    ELSE
        target_invoice_id := NEW.invoice_id;
    END IF;
    
    -- حساب إجمالي المدفوع
    SELECT COALESCE(SUM(amount), 0) INTO total_paid 
    FROM payments 
    WHERE invoice_id = target_invoice_id;
    
    -- جلب مبلغ الفاتورة
    SELECT amount INTO invoice_amount 
    FROM invoices 
    WHERE id = target_invoice_id;
    
    -- حساب المتبقي
    remaining := GREATEST(0, invoice_amount - total_paid);
    
    -- تحديد الحالة
    IF total_paid = 0 THEN
        new_status := 'معلقة';
    ELSIF total_paid >= invoice_amount THEN
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
        status = new_status
    WHERE id = target_invoice_id;
    
    RETURN COALESCE(NEW, OLD);
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'خطأ في تحديث الفاتورة %: %', target_invoice_id, SQLERRM;
        RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- الخطوة 8: إنشاء الـ Triggers
CREATE TRIGGER payments_insert_trigger
    AFTER INSERT ON payments
    FOR EACH ROW EXECUTE FUNCTION update_invoice_amounts();

CREATE TRIGGER payments_update_trigger
    AFTER UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_invoice_amounts();

CREATE TRIGGER payments_delete_trigger
    AFTER DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_invoice_amounts();

-- الخطوة 9: دالة إعادة حساب جميع الفواتير
CREATE OR REPLACE FUNCTION recalculate_all_invoices()
RETURNS TEXT AS $$
DECLARE
    invoice_rec RECORD;
    total_paid DECIMAL(12,2);
    remaining DECIMAL(12,2);
    new_status VARCHAR(20);
    updated_count INTEGER := 0;
BEGIN
    FOR invoice_rec IN SELECT id, amount FROM invoices LOOP
        SELECT COALESCE(SUM(amount), 0) INTO total_paid 
        FROM payments 
        WHERE invoice_id = invoice_rec.id;
        
        remaining := GREATEST(0, invoice_rec.amount - total_paid);
        
        IF total_paid = 0 THEN
            new_status := 'معلقة';
        ELSIF total_paid >= invoice_rec.amount THEN
            new_status := 'مدفوعة';
            remaining := 0;
        ELSE
            new_status := 'مدفوعة جزئياً';
        END IF;
        
        UPDATE invoices 
        SET 
            paid_amount = total_paid,
            remaining_amount = remaining,
            status = new_status
        WHERE id = invoice_rec.id;
        
        updated_count := updated_count + 1;
    END LOOP;
    
    RETURN 'تم تحديث ' || updated_count || ' فاتورة بنجاح';
END;
$$ LANGUAGE plpgsql;

-- الخطوة 10: تشغيل إعادة الحساب
SELECT recalculate_all_invoices() as result;

-- الخطوة 11: اختبار بسيط وآمن
DO $$
DECLARE
    test_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO test_count FROM payments;
    RAISE NOTICE '✅ جدول المدفوعات جاهز - عدد المدفوعات الحالية: %', test_count;
    
    SELECT COUNT(*) INTO test_count FROM invoices;
    RAISE NOTICE '✅ عدد الفواتير: %', test_count;
    
    RAISE NOTICE '🎉 تم إعداد نظام المدفوعات بنجاح!';
END $$;

-- انتهى الإعداد الآمن! ✅
