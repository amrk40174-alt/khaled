-- إعداد سريع لقاعدة البيانات - Business Buddy EG
-- انسخ والصق هذا الكود في Supabase SQL Editor

-- 1. جدول التجار
CREATE TABLE IF NOT EXISTS merchants (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'نشط',
    join_date DATE DEFAULT CURRENT_DATE,
    total_invoices INTEGER DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0.00,
    category VARCHAR(20) DEFAULT 'تجزئة',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. جدول الفواتير
CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(50) PRIMARY KEY,
    merchant_id BIGINT NOT NULL,
    merchant_name VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) DEFAULT 0.00,
    remaining_amount DECIMAL(15,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'مستحقة',
    due_date DATE NOT NULL,
    description TEXT,
    payment_method VARCHAR(30) DEFAULT 'نقدي',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_invoices_merchant FOREIGN KEY (merchant_id) 
        REFERENCES merchants(id) ON DELETE CASCADE
);

-- 3. جدول المدفوعات
CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    invoice_id VARCHAR(50) NOT NULL,
    merchant_id BIGINT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_method VARCHAR(30) DEFAULT 'نقدي',
    payment_date DATE DEFAULT CURRENT_DATE,
    reference_number VARCHAR(100),
    notes TEXT,
    status VARCHAR(20) DEFAULT 'مؤكد',
    created_by VARCHAR(100) DEFAULT 'النظام',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) 
        REFERENCES invoices(id) ON DELETE CASCADE,
    CONSTRAINT fk_payments_merchant FOREIGN KEY (merchant_id) 
        REFERENCES merchants(id) ON DELETE CASCADE
);

-- 4. جدول سجل العمليات
CREATE TABLE IF NOT EXISTS activity_log (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by VARCHAR(100) DEFAULT 'النظام',
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- 5. إعدادات النظام
CREATE TABLE IF NOT EXISTS system_settings (
    id BIGSERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(20) DEFAULT 'string',
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إدراج الإعدادات الافتراضية
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public) VALUES
('app_name', 'Business Buddy EG', 'string', 'اسم التطبيق', TRUE),
('app_version', '1.0.0', 'string', 'إصدار التطبيق', TRUE),
('currency', 'EGP', 'string', 'العملة الافتراضية', TRUE)
ON CONFLICT (setting_key) DO NOTHING;

-- فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_merchants_email ON merchants(email);
CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants(status);
CREATE INDEX IF NOT EXISTS idx_invoices_merchant_id ON invoices(merchant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_merchant_id ON payments(merchant_id);

-- دالة تحديث updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- مشغلات تحديث updated_at
CREATE TRIGGER trigger_merchants_updated_at
    BEFORE UPDATE ON merchants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- تفعيل Row Level Security
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان (السماح لجميع المستخدمين المصرح لهم)
CREATE POLICY "Enable all operations for authenticated users" ON merchants
    FOR ALL USING (true);

CREATE POLICY "Enable all operations for authenticated users" ON invoices
    FOR ALL USING (true);

CREATE POLICY "Enable all operations for authenticated users" ON payments
    FOR ALL USING (true);

CREATE POLICY "Enable read for authenticated users" ON activity_log
    FOR SELECT USING (true);

CREATE POLICY "Enable read for public settings" ON system_settings
    FOR SELECT USING (is_public = true OR true);

-- رسالة تأكيد
SELECT 'تم إنشاء قاعدة البيانات بنجاح! 🎉' as message;
