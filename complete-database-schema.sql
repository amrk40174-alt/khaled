-- ===================================================================
-- Business Buddy EG - Complete Database Schema
-- نظام إدارة الأعمال المصري الشامل - مخطط قاعدة البيانات الكامل
-- ===================================================================

-- تفعيل Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- ===================================================================
-- 1. جدول التجار (Merchants)
-- ===================================================================

CREATE TABLE IF NOT EXISTS merchants (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL CHECK (length(trim(name)) > 0),
    email VARCHAR(255) UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    phone VARCHAR(20) NOT NULL CHECK (length(trim(phone)) >= 10),
    address TEXT NOT NULL CHECK (length(trim(address)) > 0),
    status VARCHAR(20) DEFAULT 'نشط' CHECK (status IN ('نشط', 'معلق', 'غير نشط')),
    join_date DATE DEFAULT CURRENT_DATE,
    total_invoices INTEGER DEFAULT 0 CHECK (total_invoices >= 0),
    total_amount DECIMAL(15,2) DEFAULT 0.00 CHECK (total_amount >= 0),
    category VARCHAR(20) DEFAULT 'تجزئة' CHECK (category IN ('تجزئة', 'جملة', 'خدمات')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_merchants_email ON merchants(email);
CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants(status);
CREATE INDEX IF NOT EXISTS idx_merchants_category ON merchants(category);
CREATE INDEX IF NOT EXISTS idx_merchants_created_at ON merchants(created_at);

-- ===================================================================
-- 2. جدول الفواتير (Invoices)
-- ===================================================================

CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(50) PRIMARY KEY CHECK (length(trim(id)) > 0),
    merchant_id BIGINT NOT NULL,
    merchant_name VARCHAR(255) NOT NULL CHECK (length(trim(merchant_name)) > 0),
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    paid_amount DECIMAL(15,2) DEFAULT 0.00 CHECK (paid_amount >= 0),
    remaining_amount DECIMAL(15,2) GENERATED ALWAYS AS (amount - paid_amount) STORED,
    status VARCHAR(20) DEFAULT 'مستحقة' CHECK (status IN ('مستحقة', 'مدفوعة جزئياً', 'مدفوعة', 'ملغاة', 'متأخرة')),
    due_date DATE NOT NULL,
    description TEXT,
    payment_method VARCHAR(30) DEFAULT 'نقدي' CHECK (payment_method IN ('نقدي', 'تحويل بنكي', 'شيك', 'بطاقة ائتمان', 'محفظة إلكترونية')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- قيود التحقق
    CONSTRAINT chk_paid_amount_not_exceed CHECK (paid_amount <= amount),
    CONSTRAINT chk_due_date_future CHECK (due_date >= CURRENT_DATE - INTERVAL '1 year'),
    
    -- المفتاح الخارجي
    CONSTRAINT fk_invoices_merchant FOREIGN KEY (merchant_id) 
        REFERENCES merchants(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_invoices_merchant_id ON invoices(merchant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_amount ON invoices(amount);

-- ===================================================================
-- 3. جدول المدفوعات (Payments)
-- ===================================================================

CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    invoice_id VARCHAR(50) NOT NULL,
    merchant_id BIGINT NOT NULL,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(30) DEFAULT 'نقدي' CHECK (payment_method IN ('نقدي', 'تحويل بنكي', 'شيك', 'بطاقة ائتمان', 'محفظة إلكترونية')),
    payment_date DATE DEFAULT CURRENT_DATE,
    reference_number VARCHAR(100),
    notes TEXT,
    status VARCHAR(20) DEFAULT 'مؤكد' CHECK (status IN ('مؤكد', 'معلق', 'ملغي', 'مرفوض')),
    created_by VARCHAR(100) DEFAULT 'النظام',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- المفاتيح الخارجية
    CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) 
        REFERENCES invoices(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_payments_merchant FOREIGN KEY (merchant_id) 
        REFERENCES merchants(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_merchant_id ON payments(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- ===================================================================
-- 4. جدول سجل العمليات (Activity Log)
-- ===================================================================

CREATE TABLE IF NOT EXISTS activity_log (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_by VARCHAR(100) DEFAULT 'النظام',
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- فهارس لسجل العمليات
CREATE INDEX IF NOT EXISTS idx_activity_log_table_name ON activity_log(table_name);
CREATE INDEX IF NOT EXISTS idx_activity_log_record_id ON activity_log(record_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_log_changed_at ON activity_log(changed_at);

-- ===================================================================
-- 5. إعدادات النظام (System Settings)
-- ===================================================================

CREATE TABLE IF NOT EXISTS system_settings (
    id BIGSERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(20) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إدراج الإعدادات الافتراضية
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public) VALUES
('app_name', 'Business Buddy EG', 'string', 'اسم التطبيق', TRUE),
('app_version', '1.0.0', 'string', 'إصدار التطبيق', TRUE),
('currency', 'EGP', 'string', 'العملة الافتراضية', TRUE),
('tax_rate', '14', 'number', 'معدل الضريبة المضافة (%)', FALSE),
('late_payment_fee', '50', 'number', 'رسوم التأخير (جنيه)', FALSE),
('backup_enabled', 'true', 'boolean', 'تفعيل النسخ الاحتياطي التلقائي', FALSE)
ON CONFLICT (setting_key) DO NOTHING;

-- ===================================================================
-- 6. Functions (الدوال)
-- ===================================================================

-- دالة تحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- دالة تحديث إحصائيات التاجر
CREATE OR REPLACE FUNCTION update_merchant_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- تحديث إحصائيات التاجر عند تغيير الفواتير
    IF TG_TABLE_NAME = 'invoices' THEN
        UPDATE merchants SET
            total_invoices = (
                SELECT COUNT(*) FROM invoices
                WHERE merchant_id = COALESCE(NEW.merchant_id, OLD.merchant_id)
                AND status != 'ملغاة'
            ),
            total_amount = (
                SELECT COALESCE(SUM(amount), 0) FROM invoices
                WHERE merchant_id = COALESCE(NEW.merchant_id, OLD.merchant_id)
                AND status != 'ملغاة'
            ),
            updated_at = NOW()
        WHERE id = COALESCE(NEW.merchant_id, OLD.merchant_id);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- دالة تحديث حالة الفاتورة بناءً على المدفوعات
CREATE OR REPLACE FUNCTION update_invoice_status()
RETURNS TRIGGER AS $$
DECLARE
    invoice_amount DECIMAL(15,2);
    total_paid DECIMAL(15,2);
    invoice_status VARCHAR(20);
BEGIN
    -- الحصول على مبلغ الفاتورة
    SELECT amount INTO invoice_amount
    FROM invoices
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

    -- حساب إجمالي المدفوع
    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM payments
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
    AND status = 'مؤكد';

    -- تحديد حالة الفاتورة
    IF total_paid = 0 THEN
        invoice_status = 'مستحقة';
    ELSIF total_paid >= invoice_amount THEN
        invoice_status = 'مدفوعة';
    ELSE
        invoice_status = 'مدفوعة جزئياً';
    END IF;

    -- تحديث الفاتورة
    UPDATE invoices SET
        paid_amount = total_paid,
        status = invoice_status,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- دالة تسجيل العمليات
CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO activity_log (
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        changed_at
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id::TEXT, OLD.id::TEXT),
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END,
        NOW()
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- ===================================================================
-- 7. Triggers (المشغلات)
-- ===================================================================

-- تحديث updated_at تلقائياً
CREATE TRIGGER trigger_merchants_updated_at
    BEFORE UPDATE ON merchants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- تحديث إحصائيات التاجر
CREATE TRIGGER trigger_update_merchant_stats_on_invoice
    AFTER INSERT OR UPDATE OR DELETE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_merchant_stats();

-- تحديث حالة الفاتورة
CREATE TRIGGER trigger_update_invoice_status_on_payment
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_invoice_status();

-- تسجيل العمليات
CREATE TRIGGER trigger_log_merchants_activity
    AFTER INSERT OR UPDATE OR DELETE ON merchants
    FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER trigger_log_invoices_activity
    AFTER INSERT OR UPDATE OR DELETE ON invoices
    FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER trigger_log_payments_activity
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION log_activity();

-- ===================================================================
-- 8. Views (طرق العرض)
-- ===================================================================

-- عرض شامل للفواتير مع بيانات التاجر
CREATE OR REPLACE VIEW invoices_with_merchant AS
SELECT
    i.*,
    m.name as merchant_name_full,
    m.email as merchant_email,
    m.phone as merchant_phone,
    m.category as merchant_category,
    CASE
        WHEN i.due_date < CURRENT_DATE AND i.status IN ('مستحقة', 'مدفوعة جزئياً')
        THEN TRUE
        ELSE FALSE
    END as is_overdue,
    CASE
        WHEN i.due_date < CURRENT_DATE AND i.status IN ('مستحقة', 'مدفوعة جزئياً')
        THEN CURRENT_DATE - i.due_date
        ELSE 0
    END as days_overdue
FROM invoices i
JOIN merchants m ON i.merchant_id = m.id;

-- عرض إحصائيات شاملة
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
    -- إحصائيات التجار
    (SELECT COUNT(*) FROM merchants WHERE status = 'نشط') as active_merchants,
    (SELECT COUNT(*) FROM merchants) as total_merchants,

    -- إحصائيات الفواتير
    (SELECT COUNT(*) FROM invoices WHERE status = 'مستحقة') as pending_invoices,
    (SELECT COUNT(*) FROM invoices WHERE status = 'مدفوعة') as paid_invoices,
    (SELECT COUNT(*) FROM invoices WHERE status = 'مدفوعة جزئياً') as partial_invoices,
    (SELECT COUNT(*) FROM invoices WHERE due_date < CURRENT_DATE AND status IN ('مستحقة', 'مدفوعة جزئياً')) as overdue_invoices,

    -- إحصائيات المبالغ
    (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE status != 'ملغاة') as total_invoice_amount,
    (SELECT COALESCE(SUM(paid_amount), 0) FROM invoices WHERE status != 'ملغاة') as total_paid_amount,
    (SELECT COALESCE(SUM(remaining_amount), 0) FROM invoices WHERE status != 'ملغاة') as total_remaining_amount,

    -- إحصائيات المدفوعات
    (SELECT COUNT(*) FROM payments WHERE status = 'مؤكد') as total_payments,
    (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'مؤكد' AND payment_date = CURRENT_DATE) as today_payments,
    (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'مؤكد' AND payment_date >= CURRENT_DATE - INTERVAL '7 days') as week_payments,
    (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'مؤكد' AND payment_date >= CURRENT_DATE - INTERVAL '30 days') as month_payments;

-- عرض المدفوعات مع تفاصيل الفاتورة والتاجر
CREATE OR REPLACE VIEW payments_detailed AS
SELECT
    p.*,
    i.amount as invoice_amount,
    i.status as invoice_status,
    i.due_date as invoice_due_date,
    m.name as merchant_name,
    m.email as merchant_email,
    m.category as merchant_category
FROM payments p
JOIN invoices i ON p.invoice_id = i.id
JOIN merchants m ON p.merchant_id = m.id;

-- عرض التجار مع إحصائياتهم المحدثة
CREATE OR REPLACE VIEW merchants_with_stats AS
SELECT
    m.*,
    COALESCE(inv_stats.invoice_count, 0) as current_invoice_count,
    COALESCE(inv_stats.total_amount, 0) as current_total_amount,
    COALESCE(inv_stats.paid_amount, 0) as current_paid_amount,
    COALESCE(inv_stats.remaining_amount, 0) as current_remaining_amount,
    COALESCE(pay_stats.payment_count, 0) as payment_count,
    COALESCE(pay_stats.last_payment_date, NULL) as last_payment_date
FROM merchants m
LEFT JOIN (
    SELECT
        merchant_id,
        COUNT(*) as invoice_count,
        SUM(amount) as total_amount,
        SUM(paid_amount) as paid_amount,
        SUM(remaining_amount) as remaining_amount
    FROM invoices
    WHERE status != 'ملغاة'
    GROUP BY merchant_id
) inv_stats ON m.id = inv_stats.merchant_id
LEFT JOIN (
    SELECT
        merchant_id,
        COUNT(*) as payment_count,
        MAX(payment_date) as last_payment_date
    FROM payments
    WHERE status = 'مؤكد'
    GROUP BY merchant_id
) pay_stats ON m.id = pay_stats.merchant_id;

-- ===================================================================
-- 9. Row Level Security (RLS)
-- ===================================================================

-- تفعيل RLS على جميع الجداول
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان (للمستخدمين المصرح لهم)
CREATE POLICY "Enable all operations for authenticated users" ON merchants
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON invoices
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON payments
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read for authenticated users" ON activity_log
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read for public settings" ON system_settings
    FOR SELECT USING (is_public = true OR auth.role() = 'authenticated');

-- ===================================================================
-- 10. إعدادات الأداء والصيانة
-- ===================================================================

-- تحسين الأداء
ANALYZE merchants;
ANALYZE invoices;
ANALYZE payments;
ANALYZE activity_log;
ANALYZE system_settings;

-- إعدادات التنظيف التلقائي
-- حذف سجلات النشاط الأقدم من 6 أشهر
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM activity_log
    WHERE changed_at < NOW() - INTERVAL '6 months';
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- 11. بيانات تجريبية (اختيارية)
-- ===================================================================

-- إدراج بيانات تجريبية للاختبار
DO $$
BEGIN
    -- التحقق من عدم وجود بيانات
    IF NOT EXISTS (SELECT 1 FROM merchants LIMIT 1) THEN
        -- إدراج تاجر تجريبي
        INSERT INTO merchants (name, email, phone, address, category) VALUES
        ('شركة النور للتجارة', 'alnour@example.com', '+201234567890', 'القاهرة، مصر', 'جملة');

        -- إدراج فاتورة تجريبية
        INSERT INTO invoices (id, merchant_id, merchant_name, amount, due_date, description) VALUES
        ('INV-2025-001', 1, 'شركة النور للتجارة', 5000.00, CURRENT_DATE + INTERVAL '30 days', 'فاتورة تجريبية');
    END IF;
END $$;

-- ===================================================================
-- تم الانتهاء من إعداد قاعدة البيانات
-- ===================================================================

-- رسالة تأكيد
DO $$
BEGIN
    RAISE NOTICE '✅ تم إنشاء قاعدة البيانات بنجاح!';
    RAISE NOTICE '📊 الجداول: merchants, invoices, payments, activity_log, system_settings';
    RAISE NOTICE '🔍 العروض: invoices_with_merchant, dashboard_stats, payments_detailed, merchants_with_stats';
    RAISE NOTICE '⚡ المشغلات: تحديث تلقائي للإحصائيات والحالات';
    RAISE NOTICE '🔒 الأمان: Row Level Security مفعل';
    RAISE NOTICE '🚀 النظام جاهز للاستخدام!';
END $$;
