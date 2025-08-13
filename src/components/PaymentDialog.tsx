import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreatePayment } from "@/hooks/usePayments";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2 } from "lucide-react";
import type { Invoice } from "@/lib/supabase";
import { forceUpdateInvoice } from "@/utils/forceInvoiceUpdate";
import { toast } from "sonner";
import { translateError } from "@/utils/errorTranslator";

interface PaymentDialogProps {
  invoice: Invoice;
  children?: React.ReactNode;
  onPaymentAdded?: () => void;
}

const PaymentDialog = ({ invoice, children, onPaymentAdded }: PaymentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState("");

  const createPayment = useCreatePayment();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !paymentMethod) {
      return;
    }

    const paymentAmount = parseFloat(amount);
    if (paymentAmount <= 0) {
      return;
    }

    try {
      console.log('Creating payment with data:', {
        invoice_id: invoice.id,
        merchant_id: invoice.merchant_id,
        amount: paymentAmount,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        notes: notes || undefined,
      });

      await createPayment.mutateAsync({
        invoice_id: invoice.id,
        merchant_id: invoice.merchant_id,
        amount: paymentAmount,
        payment_method: paymentMethod as any,
        payment_date: paymentDate,
        notes: notes || undefined,
      });

      // Reset form
      setAmount("");
      setPaymentMethod("");
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setNotes("");
      setOpen(false);

      // Force update the invoice immediately
      console.log('Payment added, forcing invoice update...');
      await forceUpdateInvoice(invoice.id);

      // Force immediate refresh of all data
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['merchants-with-stats'] });
      queryClient.invalidateQueries({ queryKey: ['merchants'] });

      // Wait a moment then refresh again to ensure sync
      setTimeout(async () => {
        await queryClient.refetchQueries({ queryKey: ['invoices'] });
        await queryClient.refetchQueries({ queryKey: ['payments'] });
        await queryClient.refetchQueries({ queryKey: ['merchants-with-stats'] });

        // Call callback to refresh parent data
        if (onPaymentAdded) {
          onPaymentAdded();
        }
      }, 1000);
    } catch (error: any) {
      console.error('Error creating payment:', error);

      // استخدام المترجم للحصول على رسالة عربية واضحة
      const translatedMessage = translateError(error);

      toast.error(translatedMessage, {
        duration: 10000,
        action: {
          label: 'إصلاح سريع',
          onClick: () => {
            window.location.href = '/statistics';
          },
        },
      });
    }
  };

  const maxAmount = invoice.remaining_amount || 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-2">
            <CreditCard className="h-4 w-4" />
            إضافة دفعة
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>إضافة دفعة جديدة</DialogTitle>
          <DialogDescription>
            إضافة دفعة للفاتورة رقم {invoice.id}
            <br />
            المبلغ المتبقي في الفاتورة: {maxAmount.toLocaleString()} ج.م
            <br />
            <span className="text-sm text-muted-foreground">يمكنك إدخال أي مبلغ تريده</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">المبلغ المدفوع</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="أدخل المبلغ المدفوع"
              required
            />
            <p className="text-xs text-muted-foreground">
              المبلغ المتبقي في الفاتورة: {maxAmount.toLocaleString()} ج.م
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-method">طريقة الدفع</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod} required>
              <SelectTrigger>
                <SelectValue placeholder="اختر طريقة الدفع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="نقدي">نقدي</SelectItem>
                <SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem>
                <SelectItem value="شيك">شيك</SelectItem>
                <SelectItem value="بطاقة ائتمان">بطاقة ائتمان</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-date">تاريخ الدفع</Label>
            <Input
              id="payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات (اختياري)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أدخل أي ملاحظات إضافية"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button 
              type="submit" 
              disabled={createPayment.isPending || !amount || !paymentMethod}
            >
              {createPayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              إضافة الدفعة
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;
