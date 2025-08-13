import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoicesService, type Invoice, supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { calculateTotalPaid, calculateRemaining, getInvoiceStatus } from '@/utils/calculations'

// Get all invoices with accurate payment calculations
export const useInvoices = () => {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      // Get invoices with their payments
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          *,
          payments (
            id,
            amount,
            payment_method,
            payment_date,
            notes,
            created_at
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Calculate accurate payment amounts for each invoice
      return invoices?.map(invoice => {
        const payments = invoice.payments || [];
        const totalPaid = calculateTotalPaid(payments);
        const remaining = calculateRemaining(invoice.amount, totalPaid);
        const status = getInvoiceStatus(invoice.amount, totalPaid, invoice.status);

        return {
          ...invoice,
          paid_amount: totalPaid,
          remaining_amount: remaining,
          status: status,
          payments: payments,
        };
      }) || [];
    },
    staleTime: 30 * 1000, // 30 seconds for real-time updates
    refetchInterval: 60 * 1000, // Refetch every minute
  })
}

// Get invoice by ID
export const useInvoice = (id: string) => {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: () => invoicesService.getById(id),
    enabled: !!id,
  })
}

// Create invoice mutation
export const useCreateInvoice = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: invoicesService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['merchants'] })
      toast.success('تم إنشاء الفاتورة بنجاح')
    },
    onError: (error: any) => {
      toast.error('حدث خطأ أثناء إنشاء الفاتورة: ' + error.message)
    },
  })
}

// Update invoice mutation
export const useUpdateInvoice = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Invoice> }) =>
      invoicesService.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['merchants'] })
      toast.success('تم تحديث الفاتورة بنجاح')
    },
    onError: (error: any) => {
      toast.error('حدث خطأ أثناء تحديث الفاتورة: ' + error.message)
    },
  })
}

// Delete invoice mutation
export const useDeleteInvoice = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: invoicesService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['merchants'] })
      toast.success('تم حذف الفاتورة بنجاح')
    },
    onError: (error: any) => {
      toast.error('حدث خطأ أثناء حذف الفاتورة: ' + error.message)
    },
  })
}
