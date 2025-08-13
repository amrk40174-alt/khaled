import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, Printer, Share2, Calendar, User, Phone, MapPin } from "lucide-react";
import type { Invoice } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import PaymentsList from "@/components/PaymentsList";
import PaymentDialog from "@/components/PaymentDialog";
import { calculateTotalPaid, calculateRemaining, getInvoiceStatus, formatCurrency } from "@/utils/calculations";

interface InvoiceDetailsProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const InvoiceDetails = ({ invoice, open, onOpenChange }: InvoiceDetailsProps) => {
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(invoice);

  // Update current invoice when prop changes
  useEffect(() => {
    setCurrentInvoice(invoice);
  }, [invoice]);

  // Fetch updated invoice data with payments when dialog opens
  useEffect(() => {
    const fetchUpdatedInvoice = async () => {
      if (open && invoice?.id) {
        try {
          const { data, error } = await supabase
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
            .eq('id', invoice.id)
            .single();

          if (error) {
            console.error('Error fetching updated invoice:', error);
            // Use the original invoice if fetch fails
            setCurrentInvoice(invoice);
            return;
          }

          // Calculate accurate payment amounts
          const payments = data.payments || [];
          const totalPaid = calculateTotalPaid(payments);
          const remaining = calculateRemaining(data.amount, totalPaid);
          const status = getInvoiceStatus(data.amount, totalPaid, data.status);

          const updatedInvoice = {
            ...data,
            paid_amount: totalPaid,
            remaining_amount: remaining,
            status: status,
            payments: payments,
          };

          setCurrentInvoice(updatedInvoice as Invoice);
        } catch (error) {
          console.error('Error fetching invoice:', error);
          // Use the original invoice if fetch fails
          setCurrentInvoice(invoice);
        }
      }
    };

    if (open && invoice) {
      fetchUpdatedInvoice();
    }
  }, [open, invoice?.id]);

  // Don't render if dialog is not open
  if (!open) return null;

  // Show loading or fallback if no invoice data
  if (!currentInvoice) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تحميل البيانات...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>جاري تحميل تفاصيل الفاتورة...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "مدفوعة":
        return "bg-green-100 text-green-800 border-green-200";
      case "مدفوعة جزئياً":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "معلقة":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "متأخرة":
        return "bg-red-100 text-red-800 border-red-200";
      case "مسودة":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "ملغاة":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Function to refresh invoice data with accurate calculations
  const refreshInvoiceData = async () => {
    if (currentInvoice?.id) {
      try {
        const { data, error } = await supabase
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
          .eq('id', currentInvoice.id)
          .single();

        if (!error && data) {
          // Calculate accurate payment amounts
          const payments = data.payments || [];
          const totalPaid = calculateTotalPaid(payments);
          const remaining = calculateRemaining(data.amount, totalPaid);
          const status = getInvoiceStatus(data.amount, totalPaid, data.status);

          const updatedInvoice = {
            ...data,
            paid_amount: totalPaid,
            remaining_amount: remaining,
            status: status,
            payments: payments,
          };
          setCurrentInvoice(updatedInvoice as Invoice);
        }
      } catch (error) {
        console.error('Error refreshing invoice:', error);
      }
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('invoice-print-content');
    if (printContent) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>فاتورة ${currentInvoice.id}</title>
              <style>
                body { font-family: Arial, sans-serif; direction: rtl; margin: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .invoice-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
                .merchant-info { margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                th { background-color: #f5f5f5; }
                .total { font-weight: bold; font-size: 18px; text-align: left; }
                .status { padding: 5px 10px; border-radius: 5px; display: inline-block; }
                .status-paid { background-color: #d4edda; color: #155724; }
                .status-pending { background-color: #fff3cd; color: #856404; }
                .status-overdue { background-color: #f8d7da; color: #721c24; }
                .status-draft { background-color: #e2e3e5; color: #383d41; }
                .status-cancelled { background-color: #f8d7da; color: #721c24; }
              </style>
            </head>
            <body>
              ${printContent.innerHTML}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const handleDownload = async () => {
    try {
      // Create a canvas to generate PDF-like image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 800;
      canvas.height = 1000;
      
      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Set font and colors
      ctx.fillStyle = '#000000';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      
      // Header
      ctx.fillText('فاتورة', canvas.width / 2, 50);
      ctx.font = '18px Arial';
      ctx.fillText(`رقم الفاتورة: ${invoice.id}`, canvas.width / 2, 80);
      
      // Invoice info
      ctx.textAlign = 'right';
      ctx.font = '16px Arial';
      ctx.fillText(`التاجر: ${invoice.merchant_name}`, canvas.width - 50, 130);
      ctx.fillText(`الهاتف: ${invoice.merchant_phone}`, canvas.width - 50, 160);
      ctx.fillText(`التاريخ: ${new Date(invoice.date).toLocaleDateString('ar-EG')}`, canvas.width - 50, 190);
      ctx.fillText(`تاريخ الاستحقاق: ${new Date(invoice.due_date).toLocaleDateString('ar-EG')}`, canvas.width - 50, 220);
      ctx.fillText(`الحالة: ${invoice.status}`, canvas.width - 50, 250);
      
      // Items table header
      let y = 300;
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(50, y, canvas.width - 100, 30);
      ctx.fillStyle = '#000000';
      ctx.fillText('المنتج', canvas.width - 100, y + 20);
      ctx.fillText('الكمية', canvas.width - 250, y + 20);
      ctx.fillText('السعر', canvas.width - 350, y + 20);
      ctx.fillText('المجموع', canvas.width - 450, y + 20);
      
      // Items
      y += 40;
      invoice.items.forEach((item) => {
        ctx.fillText(item.name, canvas.width - 100, y);
        ctx.fillText(item.quantity.toString(), canvas.width - 250, y);
        ctx.fillText(`${item.price} ج.م`, canvas.width - 350, y);
        ctx.fillText(`${(item.quantity * item.price).toFixed(2)} ج.م`, canvas.width - 450, y);
        y += 30;
      });
      
      // Total
      y += 20;
      ctx.font = 'bold 20px Arial';
      ctx.fillText(`الإجمالي: ${invoice.amount.toFixed(2)} ج.م`, canvas.width - 100, y);
      
      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `فاتورة-${invoice.id}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
      
    } catch (error) {
      console.error('Error downloading invoice:', error);
      alert('حدث خطأ أثناء تحميل الفاتورة');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `فاتورة ${currentInvoice.id}`,
          text: `فاتورة من ${currentInvoice.merchant_name} بقيمة ${currentInvoice.amount.toFixed(2)} ج.م`,
          url: window.location.href
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback: copy to clipboard
      const text = `فاتورة ${currentInvoice.id}\nالتاجر: ${currentInvoice.merchant_name}\nالمبلغ: ${currentInvoice.amount.toFixed(2)} ج.م\nالحالة: ${currentInvoice.status}`;
      navigator.clipboard.writeText(text).then(() => {
        alert('تم نسخ تفاصيل الفاتورة');
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>تفاصيل الفاتورة {currentInvoice?.id || 'غير محدد'}</span>
            <div className="flex space-x-2 space-x-reverse">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 ml-1" />
                طباعة
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 ml-1" />
                تحميل
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4 ml-1" />
                مشاركة
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div id="invoice-print-content" className="space-y-6">
          {/* Header */}
          <div className="text-center border-b pb-4">
            <h1 className="text-3xl font-bold">فاتورة</h1>
            <p className="text-lg text-muted-foreground">رقم الفاتورة: {invoice.id}</p>
          </div>

          {/* Invoice Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">معلومات التاجر</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{invoice.merchant_name}</span>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{invoice.merchant_phone}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">معلومات الفاتورة</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>تاريخ الإنشاء: {new Date(invoice.date).toLocaleDateString('ar-EG')}</span>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>تاريخ الاستحقاق: {new Date(invoice.due_date).toLocaleDateString('ar-EG')}</span>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Badge className={getStatusColor(invoice.status)}>
                    {invoice.status}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Items */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">عناصر الفاتورة</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 p-3 text-right">المنتج/الخدمة</th>
                    <th className="border border-gray-300 p-3 text-center">الكمية</th>
                    <th className="border border-gray-300 p-3 text-center">السعر (ج.م)</th>
                    <th className="border border-gray-300 p-3 text-center">المجموع (ج.م)</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, index) => (
                    <tr key={index}>
                      <td className="border border-gray-300 p-3">{item.name}</td>
                      <td className="border border-gray-300 p-3 text-center">{item.quantity}</td>
                      <td className="border border-gray-300 p-3 text-center">{item.price.toFixed(2)}</td>
                      <td className="border border-gray-300 p-3 text-center">{(item.quantity * item.price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Separator />

          {/* Payment Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">ملخص المدفوعات</h3>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>إجمالي الفاتورة:</span>
                  <span className="font-semibold">{currentInvoice.amount.toFixed(2)} ج.م</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>المبلغ المدفوع:</span>
                  <span className="font-semibold">{(currentInvoice.paid_amount || 0).toFixed(2)} ج.م</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>المبلغ المتبقي:</span>
                  <span className="font-semibold">{(currentInvoice.remaining_amount || currentInvoice.amount).toFixed(2)} ج.م</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center items-end space-y-2">
              {(currentInvoice.remaining_amount || currentInvoice.amount) > 0 && (
                <PaymentDialog invoice={currentInvoice} onPaymentAdded={refreshInvoiceData}>
                  <Button className="w-full md:w-auto">
                    إضافة دفعة جديدة
                  </Button>
                </PaymentDialog>
              )}
              <div className="text-sm text-muted-foreground">
                تم إنشاء الفاتورة في: {new Date(currentInvoice.created_at).toLocaleString('ar-EG')}
              </div>
            </div>
          </div>

          <Separator />

          {/* Payments List */}
          <PaymentsList invoiceId={currentInvoice.id} onPaymentChange={refreshInvoiceData} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceDetails;
