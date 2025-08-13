import { supabase } from '@/lib/supabase';

// دالة لإعادة حساب جميع المدفوعات والفواتير
export const recalculateAllPayments = async () => {
  try {
    console.log('بدء إعادة حساب جميع المدفوعات...');

    // 1. إعادة حساب جميع الفواتير باستخدام الدالة المخزنة
    const { data: recalcResult, error: recalcError } = await supabase
      .rpc('recalculate_all_invoices');

    if (recalcError) {
      console.error('خطأ في إعادة الحساب:', recalcError);
      throw recalcError;
    }

    console.log('نتيجة إعادة الحساب:', recalcResult);

    // 2. التحقق من النتائج
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('id, amount, paid_amount, remaining_amount, status')
      .limit(5);

    if (invoicesError) {
      console.error('خطأ في جلب الفواتير:', invoicesError);
    } else {
      console.log('عينة من الفواتير المحدثة:', invoices);
    }

    return { success: true, message: recalcResult };

  } catch (error: any) {
    console.error('خطأ في إعادة حساب المدفوعات:', error);
    return { success: false, error: error.message };
  }
};

// دالة لإعادة حساب فاتورة واحدة
export const recalculateInvoicePayments = async (invoiceId: string) => {
  try {
    console.log('إعادة حساب الفاتورة:', invoiceId);

    // 1. جلب الفاتورة
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invoiceError) {
      throw invoiceError;
    }

    // 2. حساب إجمالي المدفوعات
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('amount')
      .eq('invoice_id', invoiceId);

    if (paymentsError) {
      throw paymentsError;
    }

    const totalPaid = payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
    const remaining = invoice.amount - totalPaid;

    // 3. تحديد الحالة
    let status = invoice.status;
    if (!['مسودة', 'ملغاة'].includes(invoice.status)) {
      if (totalPaid === 0) {
        status = 'معلقة';
      } else if (totalPaid >= invoice.amount) {
        status = 'مدفوعة';
      } else {
        status = 'مدفوعة جزئياً';
      }
    }

    // 4. تحديث الفاتورة
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        paid_amount: totalPaid,
        remaining_amount: Math.max(0, remaining),
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId);

    if (updateError) {
      throw updateError;
    }

    console.log(`تم تحديث الفاتورة ${invoiceId}: مدفوع=${totalPaid}, متبقي=${remaining}, حالة=${status}`);

    return { 
      success: true, 
      invoice: {
        id: invoiceId,
        paid_amount: totalPaid,
        remaining_amount: Math.max(0, remaining),
        status: status
      }
    };

  } catch (error: any) {
    console.error('خطأ في إعادة حساب الفاتورة:', error);
    return { success: false, error: error.message };
  }
};

// دالة للتحقق من صحة البيانات
export const validatePaymentsData = async () => {
  try {
    console.log('التحقق من صحة بيانات المدفوعات...');

    // 1. التحقق من وجود جدول المدفوعات
    const { data: paymentsTable, error: tableError } = await supabase
      .from('payments')
      .select('id')
      .limit(1);

    if (tableError && tableError.code === 'PGRST116') {
      return { 
        success: false, 
        error: 'جدول المدفوعات غير موجود. يرجى تشغيل COMPLETE_DATABASE_SETUP.sql أولاً.' 
      };
    }

    // 2. التحقق من الأعمدة في جدول الفواتير
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('id, amount, paid_amount, remaining_amount')
      .limit(1);

    if (invoicesError) {
      return { 
        success: false, 
        error: 'خطأ في جلب الفواتير: ' + invoicesError.message 
      };
    }

    // 3. التحقق من وجود الأعمدة المطلوبة
    if (invoices && invoices.length > 0) {
      const invoice = invoices[0];
      if (invoice.paid_amount === undefined || invoice.remaining_amount === undefined) {
        return { 
          success: false, 
          error: 'أعمدة المدفوعات غير موجودة في جدول الفواتير. يرجى تشغيل COMPLETE_DATABASE_SETUP.sql.' 
        };
      }
    }

    // 4. إحصائيات سريعة
    const { count: invoicesCount } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true });

    const { count: paymentsCount } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true });

    return { 
      success: true, 
      data: {
        invoicesCount: invoicesCount || 0,
        paymentsCount: paymentsCount || 0,
        message: 'قاعدة البيانات جاهزة ومتزامنة'
      }
    };

  } catch (error: any) {
    console.error('خطأ في التحقق من البيانات:', error);
    return { success: false, error: error.message };
  }
};

// دالة لإصلاح المزامنة
export const fixPaymentsSync = async () => {
  try {
    console.log('بدء إصلاح مزامنة المدفوعات...');

    // 1. التحقق من صحة البيانات أولاً
    const validation = await validatePaymentsData();
    if (!validation.success) {
      return validation;
    }

    // 2. إعادة حساب جميع الفواتير
    const recalcResult = await recalculateAllPayments();
    if (!recalcResult.success) {
      return recalcResult;
    }

    // 3. التحقق النهائي
    const finalValidation = await validatePaymentsData();
    
    return {
      success: true,
      message: 'تم إصلاح مزامنة المدفوعات بنجاح',
      data: finalValidation.data
    };

  } catch (error: any) {
    console.error('خطأ في إصلاح المزامنة:', error);
    return { success: false, error: error.message };
  }
};

// دالة لتحديث فاتورة واحدة بعد إضافة/حذف دفعة
export const updateInvoiceAfterPaymentChange = async (invoiceId: string) => {
  try {
    // إعادة حساب الفاتورة
    const result = await recalculateInvoicePayments(invoiceId);
    
    if (result.success) {
      // إشعار للمطورين
      console.log('تم تحديث الفاتورة بنجاح:', result.invoice);
    }
    
    return result;
  } catch (error: any) {
    console.error('خطأ في تحديث الفاتورة:', error);
    return { success: false, error: error.message };
  }
};
