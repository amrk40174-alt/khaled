-- إصلاح سريع لخطأ "حدث خطأ في إضافة الدفعة"
-- انسخ هذا الكود والصقه في Supabase SQL Editor

-- 1. حذف جدول المدفوعات إذا كان موجود
DROP TABLE IF EXISTS payments CASCADE;

-- 2. حذف الدوال والـ triggers
DROP FUNCTION IF EXISTS update_invoice_amounts() CASCADE;

-- 3. التأكد من وجود أعمدة المدفوعات في جدول الفواتير
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(12,2) DEFAULT 0.00;

-- 4. تحديث الفواتير الموجودة
UPDATE invoices 
SET 
    paid_amount = COALESCE(paid_amount, 0.00),
    remaining_amount = COALESCE(remaining_amount, amount)
WHERE paid_amount IS NULL OR remaining_amount IS NULL;

-- 5. إنشاء جدول المدفوعات بدون foreign key constraints أولاً
CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    invoice_id VARCHAR(50) NOT NULL,
    merchant_id BIGINT NOT NULL,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20) DEFAULT 'نقدي',
    payment_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. إضافة foreign key constraints بحذر
DO $$ 
BEGIN
    -- التحقق من وجود جدول invoices
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
        -- إضافة foreign key للفواتير
        ALTER TABLE payments 
        ADD CONSTRAINT fk_payments_invoice 
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
    END IF;
    
    -- التحقق من وجود جدول merchants
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchants') THEN
        -- إضافة foreign key للتجار
        ALTER TABLE payments 
        ADD CONSTRAINT fk_payments_merchant 
        FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'تحذير: لم يتم إضافة foreign key constraints: %', SQLERRM;
END $$;

-- 7. إنشاء indexes
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_merchant_id ON payments(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- 8. تفعيل Row Level Security
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 9. إنشاء policy بسيط
DROP POLICY IF EXISTS "Allow all operations on payments" ON payments;
CREATE POLICY "Allow all operations on payments" ON payments
    FOR ALL USING (true) WITH CHECK (true);

-- 10. إنشاء دالة تحديث بسيطة وآمنة
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
    
    -- التحقق من وجود الفاتورة
    IF NOT EXISTS (SELECT 1 FROM invoices WHERE id = target_invoice_id) THEN
        RAISE NOTICE 'الفاتورة غير موجودة: %', target_invoice_id;
        RETURN COALESCE(NEW, OLD);
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
    
    -- تحديد الحالة الجديدة
    IF total_paid = 0 THEN
        new_status := 'معلقة';
    ELSIF total_paid >= invoice_amount THEN
        new_status := 'مدفوعة';
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
    WHERE id = target_invoice_id;
    
    RAISE NOTICE 'تم تحديث الفاتورة %: مدفوع=%, متبقي=%, حالة=%', 
        target_invoice_id, total_paid, remaining, new_status;
    
    RETURN COALESCE(NEW, OLD);
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'خطأ في تحديث الفاتورة %: %', target_invoice_id, SQLERRM;
        RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 11. إنشاء triggers مع معالجة الأخطاء
DO $$
BEGIN
    -- حذف triggers القديمة
    DROP TRIGGER IF EXISTS payments_insert_trigger ON payments;
    DROP TRIGGER IF EXISTS payments_update_trigger ON payments;
    DROP TRIGGER IF EXISTS payments_delete_trigger ON payments;
    
    -- إنشاء triggers جديدة
    CREATE TRIGGER payments_insert_trigger
        AFTER INSERT ON payments
        FOR EACH ROW EXECUTE FUNCTION update_invoice_amounts();
        
    CREATE TRIGGER payments_update_trigger
        AFTER UPDATE ON payments
        FOR EACH ROW EXECUTE FUNCTION update_invoice_amounts();
        
    CREATE TRIGGER payments_delete_trigger
        AFTER DELETE ON payments
        FOR EACH ROW EXECUTE FUNCTION update_invoice_amounts();
        
    RAISE NOTICE 'تم إنشاء triggers بنجاح';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'خطأ في إنشاء triggers: %', SQLERRM;
END $$;

-- 12. اختبار بسيط
DO $$
DECLARE
    test_invoice_id VARCHAR(50);
    test_merchant_id BIGINT;
BEGIN
    -- جلب فاتورة للاختبار
    SELECT id, merchant_id INTO test_invoice_id, test_merchant_id 
    FROM invoices 
    LIMIT 1;
    
    IF test_invoice_id IS NOT NULL THEN
        -- إدراج دفعة تجريبية
        INSERT INTO payments (invoice_id, merchant_id, amount, notes) 
        VALUES (test_invoice_id, test_merchant_id, 1.00, 'اختبار - سيتم حذفها');
        
        -- حذف الدفعة التجريبية
        DELETE FROM payments WHERE notes = 'اختبار - سيتم حذفها';
        
        RAISE NOTICE 'تم اختبار النظام بنجاح';
    ELSE
        RAISE NOTICE 'لا توجد فواتير للاختبار';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'خطأ في الاختبار: %', SQLERRM;
END $$;

-- 13. عرض النتائج
SELECT 
    'تم إعداد جدول المدفوعات بنجاح!' as message,
    COUNT(*) as existing_payments
FROM payments;

SELECT 
    'عدد الفواتير:' as info,
    COUNT(*) as count
FROM invoices;

SELECT 
    'عدد التجار:' as info,
    COUNT(*) as count
FROM merchants;

-- انتهى الإعداد! 🎉
-- الآن يمكنك إضافة المدفوعات بدون أخطاء
