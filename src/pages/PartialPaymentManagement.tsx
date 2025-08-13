import { useState, useEffect } from "react";
import { CreditCard, FileText, AlertCircle, Loader2, Calendar, RefreshCw, Database, Eye, Plus, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { calculateTotalPaid, formatCurrency } from "@/utils/calculations";
import { forceUpdateAllInvoices, checkSyncStatus } from "@/utils/forceInvoiceUpdate";
import PaymentDialog from "@/components/PaymentDialog";
import InvoiceDetails from "@/components/InvoiceDetails";

const PartialPaymentManagement = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fixingSync, setFixingSync] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [partialInvoices, setPartialInvoices] = useState<any[]>([]);

  // Load partially paid invoices
  const loadPartialInvoices = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: invoices, error: invoicesError } = await supabase
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

      if (invoicesError) {
        throw new Error('خطأ في تحميل الفواتير');
      }

      // Filter for partially paid invoices
      const partiallyPaidInvoices = invoices?.filter(invoice => {
        const payments = invoice.payments || [];
        const totalPaid = calculateTotalPaid(payments);
        return totalPaid > 0 && totalPaid < invoice.amount;
      }).map(invoice => {
        const payments = invoice.payments || [];
        const totalPaid = calculateTotalPaid(payments);
        const remaining = Math.max(0, invoice.amount - totalPaid);
        
        return {
          ...invoice,
          paid_amount: totalPaid,
          remaining_amount: remaining,
          payments: payments,
        };
      }) || [];

      setPartialInvoices(partiallyPaidInvoices);

    } catch (error: any) {
      console.error('Error loading partial invoices:', error);
      setError(error.message || 'حدث خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPartialInvoices();
  }, []);

  // Statistics management functions
  const handleForceUpdate = async () => {
    setFixingSync(true);
    try {
      toast.info('جاري إجبار تحديث جميع الفواتير...');
      
      const result = await forceUpdateAllInvoices();
      
      if (result.success) {
        toast.success(`تم تحديث ${result.data?.success} فاتورة بنجاح من أصل ${result.data?.total}`);
        await loadPartialInvoices();
      } else {
        toast.error('فشل في التحديث: ' + result.error);
      }
    } catch (error: any) {
      console.error('خطأ في التحديث:', error);
      toast.error('حدث خطأ: ' + error.message);
    } finally {
      setFixingSync(false);
    }
  };

  const handleCheckSync = async () => {
    try {
      toast.info('جاري فحص المزامنة...');
      
      const result = await checkSyncStatus();
      
      if (result.success) {
        const syncedCount = result.data?.filter(item => item.isSync).length || 0;
        const totalCount = result.data?.length || 0;
        
        if (syncedCount === totalCount) {
          toast.success(`جميع الفواتير متزامنة (${syncedCount}/${totalCount})`);
        } else {
          toast.warning(`${syncedCount}/${totalCount} فاتورة متزامنة. انقر "إجبار التحديث" لإصلاح المشكلة.`);
        }
      } else {
        toast.error('فشل في فحص المزامنة: ' + result.error);
      }
    } catch (error: any) {
      console.error('خطأ في فحص المزامنة:', error);
      toast.error('حدث خطأ: ' + error.message);
    }
  };

  const handleQuickFix = async () => {
    try {
      toast.info('جاري فحص جدول المدفوعات...');
      
      const { error } = await supabase
        .from('payments')
        .select('id')
        .limit(1);

      if (error && error.code === 'PGRST116') {
        toast.error('جدول المدفوعات غير موجود! يرجى تشغيل الكود في Supabase SQL Editor');
      } else if (error) {
        toast.error('خطأ في الوصول لجدول المدفوعات: ' + error.message);
      } else {
        toast.success('جدول المدفوعات موجود ويعمل بشكل صحيح!');
      }
    } catch (error: any) {
      console.error('خطأ في الفحص السريع:', error);
      toast.error('حدث خطأ: ' + error.message);
    }
  };

  const handleViewDetails = (invoice: any) => {
    setSelectedInvoice(invoice);
    setShowInvoiceDetails(true);
  };

  const handlePaymentAdded = () => {
    loadPartialInvoices();
  };

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
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Filter invoices based on search term
  const filteredInvoices = partialInvoices.filter(invoice =>
    invoice.merchant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPartialAmount = partialInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalPaidAmount = partialInvoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
  const totalRemainingAmount = partialInvoices.reduce((sum, inv) => sum + (inv.remaining_amount || 0), 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">إدارة الدفع الجزئي</h1>
          <p className="text-muted-foreground">إدارة الفواتير المدفوعة جزئياً وإضافة المدفوعات</p>
        </div>
        <div className="flex items-center space-x-2 space-x-reverse">
          <Button
            onClick={handleQuickFix}
            variant="default"
            size="sm"
            className="gap-2"
          >
            <Database className="h-4 w-4" />
            إصلاح سريع
          </Button>
          <Button
            onClick={handleForceUpdate}
            disabled={fixingSync}
            variant="destructive"
            size="sm"
            className="gap-2"
          >
            {fixingSync ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            إجبار التحديث
          </Button>
          <Button
            onClick={handleCheckSync}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Database className="h-4 w-4" />
            فحص المزامنة
          </Button>
          <div className="flex items-center space-x-2 space-x-reverse text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>آخر تحديث: {new Date().toLocaleDateString('ar-EG')}</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">الفواتير الجزئية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{partialInvoices.length}</div>
            <p className="text-xs text-muted-foreground">فاتورة مدفوعة جزئياً</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">إجمالي المدفوع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaidAmount)} ج.م</div>
            <p className="text-xs text-muted-foreground">من إجمالي {formatCurrency(totalPartialAmount)} ج.م</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">إجمالي المتبقي</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalRemainingAmount)} ج.م</div>
            <p className="text-xs text-muted-foreground">متبقي للتحصيل</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>البحث والفلترة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 space-x-reverse">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="البحث بالتاجر أو رقم الفاتورة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 space-x-reverse">
            <CreditCard className="h-5 w-5" />
            <span>الفواتير المدفوعة جزئياً ({filteredInvoices.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="mr-2">جاري تحميل البيانات...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">حدث خطأ</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={loadPartialInvoices} variant="outline">
                إعادة المحاولة
              </Button>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">لا توجد فواتير مدفوعة جزئياً</h3>
              <p className="text-muted-foreground">جميع الفواتير إما مدفوعة بالكامل أو غير مدفوعة</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 space-x-reverse mb-2">
                        <h3 className="font-semibold">{invoice.merchant_name}</h3>
                        <Badge className={getStatusColor(invoice.status)}>
                          {invoice.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">رقم الفاتورة:</span>
                          <p className="font-medium">{invoice.id}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">إجمالي الفاتورة:</span>
                          <p className="font-medium">{formatCurrency(invoice.amount)} ج.م</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">المبلغ المدفوع:</span>
                          <p className="font-medium text-green-600">{formatCurrency(invoice.paid_amount || 0)} ج.م</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">المبلغ المتبقي:</span>
                          <p className="font-medium text-red-600">{formatCurrency(invoice.remaining_amount || 0)} ج.م</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(invoice)}
                        className="gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        التفاصيل
                      </Button>
                      <PaymentDialog invoice={invoice} onPaymentAdded={handlePaymentAdded}>
                        <Button size="sm" className="gap-2">
                          <Plus className="h-4 w-4" />
                          إضافة دفعة
                        </Button>
                      </PaymentDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Details Dialog */}
      <InvoiceDetails
        invoice={selectedInvoice}
        open={showInvoiceDetails}
        onOpenChange={setShowInvoiceDetails}
      />
    </div>
  );
};

export default PartialPaymentManagement;
