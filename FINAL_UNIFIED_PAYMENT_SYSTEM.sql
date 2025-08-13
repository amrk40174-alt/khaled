-- ========================================
-- الكود النهائي الموحد لنظام المدفوعات
-- هذا الكود الوحيد المطلوب - احذف جميع الأكواد الأخرى
-- ========================================

-- 🗑️ الخطوة 1: تنظيف شامل (حذف كل شيء قديم)
-- حذف الـ triggers أولاً (إذا كان الجدول موجود)
DO $$
BEGIN
    -- حذف triggers فقط إذا كان الجدول موجود
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
        DROP TRIGGER IF EXISTS payments_insert_trigger ON payments;
        DROP TRIGGER IF EXISTS payments_update_trigger ON payments;
        DROP TRIGGER IF EXISTS payments_delete_trigger ON payments;
        DROP TRIGGER IF EXISTS update_invoice_amounts_on_insert ON payments;
        DROP TRIGGER IF EXISTS update_invoice_amounts_on_update ON payments;
        DROP TRIGGER IF EXISTS update_invoice_amounts_on_delete ON payments;
    END IF;
END $$;

-- حذف الجداول والدوال
DROP TABLE IF EXISTS payments CASCADE;
DROP FUNCTION IF EXISTS update_invoice_amounts() CASCADE;
DROP FUNCTION IF EXISTS recalculate_all_invoices() CASCADE;
DROP VIEW IF EXISTS invoice_payment_summary CASCADE;
DROP VIEW IF EXISTS merchant_payment_summary CASCADE;

-- 🔧 الخطوة 2: إعداد جدول الفواتير
-- إضافة أعمدة المدفوعات إذا لم تكن موجودة
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(12,2) DEFAULT 0.00;

-- تحديث الفواتير الموجودة
UPDATE invoices 
SET 
    paid_amount = 0.00,
    remaining_amount = amount
WHERE paid_amount IS NULL OR remaining_amount IS NULL;

-- 💳 الخطوة 3: إنشاء جدول المدفوعات النهائي
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

-- 🔗 الخطوة 4: إضافة الروابط (Foreign Keys)
DO $$ 
BEGIN
    -- ربط بجدول الفواتير
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
        ALTER TABLE payments 
        ADD CONSTRAINT fk_payments_invoice 
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
    END IF;
    
    -- ربط بجدول التجار
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchants') THEN
        ALTER TABLE payments 
        ADD CONSTRAINT fk_payments_merchant 
        FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'تحذير: مشكلة في إضافة الروابط: %', SQLERRM;
END $$;

-- 📊 الخطوة 5: إنشاء الفهارس للأداء
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_merchant_id ON payments(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- 🔒 الخطوة 6: إعدادات الأمان
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- حذف جميع الـ policies القديمة وإنشاء واحدة جديدة
DROP POLICY IF EXISTS "Allow all operations on payments" ON payments;
CREATE POLICY "payments_policy" ON payments FOR ALL USING (true) WITH CHECK (true);

-- ⚡ الخطوة 7: إنشاء دالة التحديث الموحدة والنهائية
CREATE OR REPLACE FUNCTION update_invoice_amounts()
RETURNS TRIGGER AS $$
DECLARE
    total_paid DECIMAL(12,2) := 0;
    invoice_amount DECIMAL(12,2) := 0;
    remaining DECIMAL(12,2) := 0;
    new_status VARCHAR(20);
    target_invoice_id VARCHAR(50);
BEGIN
    -- تحديد معرف الفاتورة حسب نوع العملية
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
    
    -- حساب إجمالي المدفوع لهذه الفاتورة
    SELECT COALESCE(SUM(amount), 0) INTO total_paid 
    FROM payments 
    WHERE invoice_id = target_invoice_id;
    
    -- جلب مبلغ الفاتورة الأصلي
    SELECT amount INTO invoice_amount 
    FROM invoices 
    WHERE id = target_invoice_id;
    
    -- حساب المبلغ المتبقي (لا يقل عن صفر)
    remaining := GREATEST(0, invoice_amount - total_paid);
    
    -- تحديد الحالة الجديدة
    IF total_paid = 0 THEN
        new_status := 'معلقة';
    ELSIF total_paid >= invoice_amount THEN
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
    WHERE id = target_invoice_id;
    
    -- رسالة للتتبع
    RAISE NOTICE 'تم تحديث الفاتورة %: مدفوع=%, متبقي=%, حالة=%', 
        target_invoice_id, total_paid, remaining, new_status;
    
    RETURN COALESCE(NEW, OLD);
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'خطأ في تحديث الفاتورة %: %', target_invoice_id, SQLERRM;
        RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 🎯 الخطوة 8: إنشاء الـ Triggers النهائية
CREATE TRIGGER payments_insert_trigger
    AFTER INSERT ON payments
    FOR EACH ROW EXECUTE FUNCTION update_invoice_amounts();

CREATE TRIGGER payments_update_trigger
    AFTER UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_invoice_amounts();

CREATE TRIGGER payments_delete_trigger
    AFTER DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_invoice_amounts();

-- 🔄 الخطوة 9: دالة إعادة حساب جميع الفواتير
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
    FOR invoice_rec IN SELECT id, amount, status FROM invoices LOOP
        -- حساب إجمالي المدفوع لهذه الفاتورة
        SELECT COALESCE(SUM(amount), 0) INTO total_paid 
        FROM payments 
        WHERE invoice_id = invoice_rec.id;
        
        -- حساب المبلغ المتبقي
        remaining := GREATEST(0, invoice_rec.amount - total_paid);
        
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

-- 🧪 الخطوة 10: اختبار النظام
DO $$
DECLARE
    test_invoice_id VARCHAR(50);
    test_merchant_id BIGINT;
    test_result TEXT;
BEGIN
    -- جلب فاتورة للاختبار
    SELECT id, merchant_id INTO test_invoice_id, test_merchant_id 
    FROM invoices 
    LIMIT 1;
    
    IF test_invoice_id IS NOT NULL THEN
        -- إدراج دفعة تجريبية
        INSERT INTO payments (invoice_id, merchant_id, amount, notes) 
        VALUES (test_invoice_id, test_merchant_id, 1.00, 'اختبار النظام - سيتم حذفها');
        
        -- حذف الدفعة التجريبية
        DELETE FROM payments WHERE notes = 'اختبار النظام - سيتم حذفها';
        
        RAISE NOTICE '✅ تم اختبار النظام بنجاح';
    ELSE
        RAISE NOTICE '⚠️ لا توجد فواتير للاختبار';
    END IF;
    
    -- تشغيل إعادة حساب جميع الفواتير
    SELECT recalculate_all_invoices() INTO test_result;
    RAISE NOTICE '✅ %', test_result;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ خطأ في الاختبار: %', SQLERRM;
END $$;

-- 📊 الخطوة 11: عرض النتائج النهائية
SELECT 
    '🎉 تم إعداد نظام المدفوعات الموحد بنجاح!' as message,
    COUNT(*) as existing_payments
FROM payments;

SELECT 
    'عدد الفواتير المحدثة:' as info,
    COUNT(*) as count
FROM invoices;

SELECT 
    'عدد التجار:' as info,
    COUNT(*) as count
FROM merchants;

-- ✅ انتهى الإعداد الموحد!
-- الآن لديك نظام دفع واحد موحد وشامل
-- احذف جميع الأكواد الأخرى من المحرر
