import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { merchantsService, type Merchant, supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { calculateMerchantStats, calculateTotalPaid, calculateRemaining, getInvoiceStatus } from '@/utils/calculations'

// Get all merchants
export const useMerchants = () => {
  return useQuery({
    queryKey: ['merchants'],
    queryFn: merchantsService.getAll,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Get merchants with accurate invoice statistics
export const useMerchantsWithStats = () => {
  return useQuery({
    queryKey: ['merchants-with-stats'],
    queryFn: async () => {
      // Get all merchants
      const merchants = await merchantsService.getAll();

      // Get invoice statistics for each merchant with payments
      const merchantsWithStats = await Promise.all(
        merchants.map(async (merchant) => {
          const { data: invoices, error } = await supabase
            .from('invoices')
            .select(`
              id,
              amount,
              paid_amount,
              remaining_amount,
              status,
              payments (
                id,
                amount,
                payment_method,
                payment_date
              )
            `)
            .eq('merchant_id', merchant.id);

          if (error) {
            console.error('Error fetching invoices for merchant:', merchant.id, error);
            return {
              ...merchant,
              totalInvoices: 0,
              totalAmount: 0,
              totalPaid: 0,
              totalRemaining: 0,
              paidInvoices: 0,
              pendingInvoices: 0,
            };
          }

          // Calculate accurate statistics using the calculation utilities
          const invoicesWithPayments = invoices?.map(invoice => {
            const payments = invoice.payments || [];
            const totalPaid = calculateTotalPaid(payments);
            const remaining = calculateRemaining(invoice.amount, totalPaid);
            const status = getInvoiceStatus(invoice.amount, totalPaid, invoice.status);

            return {
              ...invoice,
              amount: invoice.amount,
              paid_amount: totalPaid,
              remaining_amount: remaining,
              status: status,
              payments: payments,
            };
          }) || [];

          const stats = calculateMerchantStats(invoicesWithPayments);
          const paidInvoices = invoicesWithPayments.filter(inv => inv.status === 'مدفوعة').length;
          const pendingInvoices = invoicesWithPayments.filter(inv =>
            inv.status === 'معلقة' || inv.status === 'متأخرة' || inv.status === 'مدفوعة جزئياً'
          ).length;

          return {
            ...merchant,
            totalInvoices: stats.totalInvoices,
            totalAmount: stats.totalAmount,
            totalPaid: stats.totalPaid,
            totalRemaining: stats.totalRemaining,
            paidInvoices,
            pendingInvoices,
          };
        })
      );

      return merchantsWithStats;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Get merchant by ID
export const useMerchant = (id: number) => {
  return useQuery({
    queryKey: ['merchants', id],
    queryFn: () => merchantsService.getById(id),
    enabled: !!id,
  })
}

// Create merchant mutation
export const useCreateMerchant = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: merchantsService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchants'] })
      toast.success('تم إضافة التاجر بنجاح')
    },
    onError: (error: any) => {
      toast.error('حدث خطأ أثناء إضافة التاجر: ' + error.message)
    },
  })
}

// Update merchant mutation
export const useUpdateMerchant = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<Merchant> }) =>
      merchantsService.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchants'] })
      toast.success('تم تحديث بيانات التاجر بنجاح')
    },
    onError: (error: any) => {
      toast.error('حدث خطأ أثناء تحديث التاجر: ' + error.message)
    },
  })
}

// Delete merchant mutation
export const useDeleteMerchant = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: merchantsService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchants'] })
      toast.success('تم حذف التاجر بنجاح')
    },
    onError: (error: any) => {
      toast.error('حدث خطأ أثناء حذف التاجر: ' + error.message)
    },
  })
}
