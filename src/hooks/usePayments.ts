import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Payment } from '@/lib/supabase';
import { toast } from 'sonner';
import { translateError } from '@/utils/errorTranslator';
import { calculateTotalPaid, calculateRemaining, getInvoiceStatus } from '@/utils/calculations';

export const usePayments = (invoiceId?: string) => {
  return useQuery({
    queryKey: ['payments', invoiceId],
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (invoiceId) {
        query = query.eq('invoice_id', invoiceId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching payments:', error);
        throw error;
      }

      return data as Payment[];
    },
  });
};

export const useCreatePayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payment: Omit<Payment, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('payments')
        .insert([payment])
        .select()
        .single();

      if (error) {
        console.error('Error creating payment:', error);
        throw error;
      }

      return data as Payment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['merchants'] });
      toast.success('تم إضافة الدفعة بنجاح');
    },
    onError: (error: any) => {
      console.error('Error creating payment:', error);

      // استخدام المترجم الجديد للحصول على رسالة عربية واضحة
      const translatedMessage = translateError(error);

      toast.error(translatedMessage, {
        duration: 10000, // عرض الرسالة لمدة أطول
        action: {
          label: 'إصلاح سريع',
          onClick: () => {
            // توجيه المستخدم إلى صفحة الإحصائيات
            window.location.href = '/statistics';
          },
        },
      });
    },
  });
};

export const useUpdatePayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payment }: Partial<Payment> & { id: number }) => {
      const { data, error } = await supabase
        .from('payments')
        .update(payment)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating payment:', error);
        throw error;
      }

      return data as Payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['merchants'] });
      toast.success('تم تحديث الدفعة بنجاح');
    },
    onError: (error: any) => {
      console.error('Error updating payment:', error);
      toast.error('حدث خطأ في تحديث الدفعة');
    },
  });
};

export const useDeletePayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting payment:', error);
        throw error;
      }

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['merchants'] });
      toast.success('تم حذف الدفعة بنجاح');
    },
    onError: (error: any) => {
      console.error('Error deleting payment:', error);
      toast.error('حدث خطأ في حذف الدفعة');
    },
  });
};

// Hook to get payment statistics
export const usePaymentStats = () => {
  return useQuery({
    queryKey: ['payment-stats'],
    queryFn: async () => {
      // Get total payments
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('amount, payment_method, payment_date');

      if (paymentsError) {
        console.error('Error fetching payment stats:', paymentsError);
        throw paymentsError;
      }

      // Get invoice totals
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('amount, paid_amount, remaining_amount, status');

      if (invoicesError) {
        console.error('Error fetching invoice stats:', invoicesError);
        throw invoicesError;
      }

      const totalPaid = payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
      const totalInvoiceAmount = invoices?.reduce((sum, invoice) => sum + invoice.amount, 0) || 0;
      const totalRemaining = invoices?.reduce((sum, invoice) => sum + (invoice.remaining_amount || 0), 0) || 0;

      const cashPayments = payments?.filter(p => p.payment_method === 'نقدي').reduce((sum, p) => sum + p.amount, 0) || 0;
      const bankTransfers = payments?.filter(p => p.payment_method === 'تحويل بنكي').reduce((sum, p) => sum + p.amount, 0) || 0;

      return {
        totalPaid,
        totalInvoiceAmount,
        totalRemaining,
        cashPayments,
        bankTransfers,
        paymentCount: payments?.length || 0,
        fullyPaidInvoices: invoices?.filter(i => i.status === 'مدفوعة').length || 0,
        partiallyPaidInvoices: invoices?.filter(i => i.status === 'مدفوعة جزئياً').length || 0,
        unpaidInvoices: invoices?.filter(i => i.status === 'معلقة').length || 0,
      };
    },
  });
};
