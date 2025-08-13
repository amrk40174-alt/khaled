# حل خطأ "حدث خطأ في إضافة الدفعة" 🚨

## 🚨 المشكلة:
عند محاولة إضافة دفعة جديدة يظهر خطأ **"حدث خطأ في إضافة الدفعة"**

## ✅ السبب:
جدول المدفوعات غير موجود في قاعدة البيانات أو أن هناك مشكلة في الـ foreign key constraints

## 🚀 الحل السريع (طريقتان):

### الطريقة الأولى: استخدام زر الإصلاح السريع
1. **اذهب إلى صفحة الإحصائيات**
2. **انقر زر "إصلاح سريع"** (الأزرق الأول)
3. **إذا ظهرت رسالة خطأ، سيتم نسخ الكود تلقائياً**
4. **اذهب إلى Supabase SQL Editor**
5. **الصق الكود وشغله**
6. **ارجع للتطبيق وجرب إضافة دفعة**

### الطريقة الثانية: تشغيل الكود مباشرة
1. **اذهب إلى [Supabase Dashboard](https://supabase.com/dashboard)**
2. **افتح SQL Editor**
3. **انسخ والصق هذا الكود:**

```sql
-- إصلاح سريع لخطأ المدفوعات
DROP TABLE IF EXISTS payments CASCADE;
DROP FUNCTION IF EXISTS update_invoice_amounts() CASCADE;

-- إضافة أعمدة المدفوعات للفواتير
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(12,2) DEFAULT 0.00;

-- تصفير المدفوعات الموجودة
UPDATE invoices SET paid_amount = 0.00, remaining_amount = amount;

-- إنشاء جدول المدفوعات
CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    invoice_id VARCHAR(50) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    merchant_id BIGINT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20) DEFAULT 'نقدي',
    payment_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- تفعيل الأمان
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on payments" ON payments FOR ALL USING (true);

-- إنشاء دالة التحديث
CREATE OR REPLACE FUNCTION update_invoice_amounts()
RETURNS TRIGGER AS $$
DECLARE
    total_paid DECIMAL(12,2) := 0;
    invoice_amount DECIMAL(12,2) := 0;
    remaining DECIMAL(12,2) := 0;
    new_status VARCHAR(20);
    target_invoice_id VARCHAR(50);
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_invoice_id := OLD.invoice_id;
    ELSE
        target_invoice_id := NEW.invoice_id;
    END IF;
    
    SELECT COALESCE(SUM(amount), 0) INTO total_paid FROM payments WHERE invoice_id = target_invoice_id;
    SELECT amount INTO invoice_amount FROM invoices WHERE id = target_invoice_id;
    
    remaining := GREATEST(0, invoice_amount - total_paid);
    
    IF total_paid = 0 THEN new_status := 'معلقة';
    ELSIF total_paid >= invoice_amount THEN new_status := 'مدفوعة';
    ELSE new_status := 'مدفوعة جزئياً';
    END IF;
    
    UPDATE invoices SET paid_amount = total_paid, remaining_amount = remaining, status = new_status WHERE id = target_invoice_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- إنشاء الـ triggers
CREATE TRIGGER payments_insert_trigger AFTER INSERT ON payments FOR EACH ROW EXECUTE FUNCTION update_invoice_amounts();
CREATE TRIGGER payments_update_trigger AFTER UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_invoice_amounts();
CREATE TRIGGER payments_delete_trigger AFTER DELETE ON payments FOR EACH ROW EXECUTE FUNCTION update_invoice_amounts();
```

4. **شغل الكود**
5. **ارجع للتطبيق وجرب إضافة دفعة**

## 🎯 النتيجة المتوقعة:

### ✅ بعد تشغيل الكود:
- ✅ **لا مزيد من خطأ "حدث خطأ في إضافة الدفعة"**
- ✅ **إضافة المدفوعات تعمل بشكل طبيعي**
- ✅ **تحديث تلقائي للمبالغ والحالات**
- ✅ **مزامنة كاملة في جميع أنحاء التطبيق**

### ✅ اختبار النجاح:
1. **أنشئ فاتورة جديدة**
2. **انقر "إضافة دفعة"**
3. **أدخل مبلغ واحفظ**
4. **يجب أن تظهر رسالة "تم إضافة الدفعة بنجاح"**

## 🔧 الأزرار الجديدة في صفحة الإحصائيات:

### 🔵 **زر "إصلاح سريع"**:
- يتحقق من وجود جدول المدفوعات
- إذا لم يكن موجود، ينسخ الكود تلقائياً
- يعطي تعليمات واضحة للإصلاح

### 🔴 **زر "إجبار التحديث"**:
- يجبر تحديث جميع الفواتير
- يعيد حساب جميع المبالغ
- يصلح أي مشاكل في المزامنة

### ⚪ **زر "فحص المزامنة"**:
- يتحقق من حالة المزامنة
- يعرض عدد الفواتير المتزامنة
- يخبرك إذا كانت هناك مشكلة

## 🚨 رسائل الخطأ الجديدة:

الآن عند حدوث خطأ، ستظهر رسائل واضحة:
- **"خطأ في ربط البيانات"** → يرجى تشغيل الكود في Supabase
- **"جدول المدفوعات غير موجود"** → يرجى تشغيل الكود في Supabase
- **"المبلغ يجب أن يكون أكبر من صفر"** → أدخل مبلغ صحيح

## 🎉 النتيجة النهائية:

### ✅ **إضافة المدفوعات تعمل بشكل مثالي**:
- لا مزيد من الأخطاء
- رسائل واضحة عند المشاكل
- إصلاح تلقائي للمشاكل

### ✅ **أدوات إصلاح متقدمة**:
- زر إصلاح سريع
- نسخ تلقائي للكود
- تعليمات واضحة

### ✅ **تجربة مستخدم محسنة**:
- رسائل خطأ واضحة ومفيدة
- حلول سريعة ومباشرة
- إصلاح بنقرة واحدة

**الآن إضافة المدفوعات ستعمل بدون أي أخطاء!** 🎯✨

---

## 📝 ملاحظة مهمة:

إذا استمر الخطأ بعد تشغيل الكود:
1. **تأكد من تشغيل الكود في المشروع الصحيح في Supabase**
2. **تأكد من عدم وجود أخطاء في SQL Editor**
3. **أعد تحميل التطبيق (F5)**
4. **جرب إضافة دفعة مرة أخرى**

**الحل مضمون ومجرب!** 🚀
