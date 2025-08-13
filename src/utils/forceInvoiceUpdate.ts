import { supabase } from '@/lib/supabase';

// دالة لإجبار تحديث فاتورة واحدة
export const forceUpdateInvoice = async (invoiceId: string) => {
  try {
    console.log('Force updating invoice:', invoiceId);

    // 1. جلب جميع المدفوعات لهذه الفاتورة
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('amount')
      .eq('invoice_id', invoiceId);

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
      return { success: false, error: paymentsError.message };
    }

    // 2. جلب الفاتورة
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('amount, status')
      .eq('id', invoiceId)
      .single();

    if (invoiceError) {
      console.error('Error fetching invoice:', invoiceError);
      return { success: false, error: invoiceError.message };
    }

    // 3. حساب المبالغ
    const totalPaid = payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
    const remaining = Math.max(0, invoice.amount - totalPaid);

    // 4. تحديد الحالة
    let newStatus = invoice.status;
    if (!['مسودة', 'ملغاة'].includes(invoice.status)) {
      if (totalPaid === 0) {
        newStatus = 'معلقة';
      } else if (totalPaid >= invoice.amount) {
        newStatus = 'مدفوعة';
      } else {
        newStatus = 'مدفوعة جزئياً';
      }
    }

    // 5. تحديث الفاتورة مباشرة
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        paid_amount: totalPaid,
        remaining_amount: remaining,
        status: newStatus
      })
      .eq('id', invoiceId);

    if (updateError) {
      console.error('Error updating invoice:', updateError);
      return { success: false, error: updateError.message };
    }

    console.log(`Invoice ${invoiceId} updated: paid=${totalPaid}, remaining=${remaining}, status=${newStatus}`);

    return {
      success: true,
      data: {
        invoiceId,
        totalPaid,
        remaining,
        status: newStatus
      }
    };

  } catch (error: any) {
    console.error('Error in forceUpdateInvoice:', error);
    return { success: false, error: error.message };
  }
};

// دالة لإجبار تحديث جميع الفواتير
export const forceUpdateAllInvoices = async () => {
  try {
    console.log('Force updating all invoices...');

    // جلب جميع الفواتير
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('id');

    if (invoicesError) {
      return { success: false, error: invoicesError.message };
    }

    let successCount = 0;
    let errorCount = 0;

    // تحديث كل فاتورة
    for (const invoice of invoices || []) {
      const result = await forceUpdateInvoice(invoice.id);
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
        console.error(`Failed to update invoice ${invoice.id}:`, result.error);
      }
    }

    return {
      success: true,
      data: {
        total: invoices?.length || 0,
        success: successCount,
        errors: errorCount
      }
    };

  } catch (error: any) {
    console.error('Error in forceUpdateAllInvoices:', error);
    return { success: false, error: error.message };
  }
};

// دالة للتحقق من المزامنة
export const checkSyncStatus = async () => {
  try {
    // جلب عينة من الفواتير مع المدفوعات
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select(`
        id,
        amount,
        paid_amount,
        remaining_amount,
        status
      `)
      .limit(5);

    if (error) {
      return { success: false, error: error.message };
    }

    const results = [];

    for (const invoice of invoices || []) {
      // جلب المدفوعات لهذه الفاتورة
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('invoice_id', invoice.id);

      const actualPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const isSync = Math.abs((invoice.paid_amount || 0) - actualPaid) < 0.01;

      results.push({
        invoiceId: invoice.id,
        invoiceAmount: invoice.amount,
        storedPaid: invoice.paid_amount || 0,
        actualPaid,
        isSync,
        status: invoice.status
      });
    }

    return { success: true, data: results };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
