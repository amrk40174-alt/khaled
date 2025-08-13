import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { usePayments, useDeletePayment } from "@/hooks/usePayments";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard, Trash2, Loader2 } from "lucide-react";
import type { Payment } from "@/lib/supabase";
import { updateInvoiceAfterPaymentChange } from "@/utils/fixPaymentsDatabase";

interface PaymentsListProps {
  invoiceId: string;
  onPaymentChange?: () => void;
}

const PaymentsList = ({ invoiceId, onPaymentChange }: PaymentsListProps) => {
  const { data: payments = [], isLoading } = usePayments(invoiceId);
  const deletePayment = useDeletePayment();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (paymentId: number) => {
    try {
      setDeletingId(paymentId);

      // Get payment info before deletion
      const payment = payments.find(p => p.id === paymentId);

      await deletePayment.mutateAsync(paymentId);

      // Update invoice amounts immediately
      if (payment) {
        await updateInvoiceAfterPaymentChange(payment.invoice_id);
      }

      // Refresh all related data
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['merchants-with-stats'] });

      // Call callback to refresh parent data
      if (onPaymentChange) {
        onPaymentChange();
      }
    } catch (error) {
      console.error('Error deleting payment:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const getPaymentMethodBadge = (method: Payment['payment_method']) => {
    const variants = {
      'نقدي': 'default',
      'تحويل بنكي': 'secondary',
      'شيك': 'outline',
      'بطاقة ائتمان': 'destructive',
    } as const;

    return (
      <Badge variant={variants[method] || 'default'}>
        {method}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 space-x-reverse">
            <CreditCard className="h-5 w-5" />
            <span>المدفوعات</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="mr-2">جاري تحميل المدفوعات...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (payments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 space-x-reverse">
            <CreditCard className="h-5 w-5" />
            <span>المدفوعات</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">لا توجد مدفوعات</h3>
            <p className="text-muted-foreground">لم يتم تسجيل أي مدفوعات لهذه الفاتورة بعد</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2 space-x-reverse">
            <CreditCard className="h-5 w-5" />
            <span>المدفوعات</span>
          </div>
          <div className="text-sm font-normal">
            إجمالي المدفوع: <span className="font-bold text-green-600">{totalPaid.toLocaleString()} ج.م</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>المبلغ</TableHead>
              <TableHead>طريقة الدفع</TableHead>
              <TableHead>تاريخ الدفع</TableHead>
              <TableHead>ملاحظات</TableHead>
              <TableHead>الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="font-medium">
                  {payment.amount.toLocaleString()} ج.م
                </TableCell>
                <TableCell>
                  {getPaymentMethodBadge(payment.payment_method)}
                </TableCell>
                <TableCell>
                  {new Date(payment.payment_date).toLocaleDateString('ar-EG')}
                </TableCell>
                <TableCell>
                  {payment.notes || '-'}
                </TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2 text-destructive hover:text-destructive"
                        disabled={deletingId === payment.id}
                      >
                        {deletingId === payment.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        حذف
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent dir="rtl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                        <AlertDialogDescription>
                          هل أنت متأكد من حذف هذه الدفعة؟ 
                          <br />
                          المبلغ: {payment.amount.toLocaleString()} ج.م
                          <br />
                          هذا الإجراء لا يمكن التراجع عنه.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(payment.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          حذف
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default PaymentsList;
