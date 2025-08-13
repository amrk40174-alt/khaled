import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export const useRealtimeUpdates = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to payments table changes
    const paymentsSubscription = supabase
      .channel('payments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments'
        },
        (payload) => {
          console.log('Payment change detected:', payload);
          
          // Invalidate all related queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['payments'] });
          queryClient.invalidateQueries({ queryKey: ['invoices'] });
          queryClient.invalidateQueries({ queryKey: ['merchants'] });
          queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
          
          // Force refetch statistics data
          queryClient.refetchQueries({ queryKey: ['payments'] });
          queryClient.refetchQueries({ queryKey: ['invoices'] });
        }
      )
      .subscribe();

    // Subscribe to invoices table changes (for payment-related updates)
    const invoicesSubscription = supabase
      .channel('invoices-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'invoices'
        },
        (payload) => {
          console.log('Invoice change detected:', payload);
          
          // Check if payment-related fields changed
          const oldRecord = payload.old as any;
          const newRecord = payload.new as any;
          
          if (
            oldRecord?.paid_amount !== newRecord?.paid_amount ||
            oldRecord?.remaining_amount !== newRecord?.remaining_amount ||
            oldRecord?.status !== newRecord?.status
          ) {
            // Payment-related change, invalidate all queries
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['merchants'] });
            queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
          }
        }
      )
      .subscribe();

    // Subscribe to merchants table changes
    const merchantsSubscription = supabase
      .channel('merchants-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'merchants'
        },
        (payload) => {
          console.log('Merchant change detected:', payload);
          
          // Invalidate related queries
          queryClient.invalidateQueries({ queryKey: ['merchants'] });
          queryClient.invalidateQueries({ queryKey: ['invoices'] });
          queryClient.invalidateQueries({ queryKey: ['payments'] });
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      paymentsSubscription.unsubscribe();
      invoicesSubscription.unsubscribe();
      merchantsSubscription.unsubscribe();
    };
  }, [queryClient]);

  // Manual refresh function
  const refreshAllData = () => {
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['merchants'] });
    queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
  };

  return { refreshAllData };
};

// Hook for automatic refresh on window focus
export const useAutoRefresh = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleFocus = () => {
      // Refetch all queries when window regains focus
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['merchants'] });
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [queryClient]);
};

// Hook for periodic refresh
export const usePeriodicRefresh = (intervalMs: number = 30000) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const interval = setInterval(() => {
      // Refetch payment-related data every 30 seconds
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [queryClient, intervalMs]);
};
