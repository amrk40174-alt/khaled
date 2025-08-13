import { useState, useEffect } from "react";
import StatsCard from "@/components/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, FileText, Banknote, CreditCard, Calendar, RefreshCw, Database, Loader2 } from "lucide-react";
import { useInvoices } from "@/hooks/useInvoices";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { calculateTotalPaid, formatCurrency } from "@/utils/calculations";
import { forceUpdateAllInvoices, checkSyncStatus } from "@/utils/forceInvoiceUpdate";

const Dashboard = () => {
  const { data: invoices = [], isLoading: invoicesLoading } = useInvoices();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fixingSync, setFixingSync] = useState(false);
  const [detailedStats, setDetailedStats] = useState({
    totalMerchants: 0,
    activeMerchants: 0,
    totalInvoices: 0,
    totalInvoiceAmount: 0,
    totalPaid: 0,
    totalRemaining: 0,
    fullyPaidInvoices: 0,
    partiallyPaidInvoices: 0,
    unpaidInvoices: 0,
    cashPayments: 0,
    bankTransfers: 0,
  });

  // Load detailed statistics
  const loadDetailedStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get merchants count
      const { count: merchantsCount, error: merchantsError } = await supabase
        .from('merchants')
        .select('*', { count: 'exact', head: true });

      if (merchantsError) {
        throw new Error('خطأ في تحميل بيانات التجار');
      }

      // Get active merchants count
      const { count: activeMerchantsCount } = await supabase
        .from('merchants')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'نشط');

      // Get invoices count
      const { count: invoicesCount, error: invoicesError } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true });

      if (invoicesError) {
        throw new Error('خطأ في تحميل بيانات الفواتير');
      }

      // Get invoice amounts with payments for accurate calculations
      const { data: invoicesData, error: invoicesDataError } = await supabase
        .from('invoices')
        .select(`
          amount,
          paid_amount,
          remaining_amount,
          status,
          payments (
            amount,
            payment_method
          )
        `);

      if (invoicesDataError) {
        console.error('Invoices data error:', invoicesDataError);
      }

      // Get all payments data
      const { data: paymentsData, error: paymentsDataError } = await supabase
        .from('payments')
        .select('amount, payment_method');

      if (paymentsDataError) {
        console.error('Payments data error:', paymentsDataError);
      }

      // Calculate accurate statistics
      const invoicesWithPayments = invoicesData?.map(invoice => ({
        ...invoice,
        payments: invoice.payments || []
      })) || [];

      const totalInvoiceAmount = invoicesWithPayments.reduce((sum, inv) => sum + inv.amount, 0);
      const totalPaid = calculateTotalPaid(paymentsData || []);
      const totalRemaining = invoicesWithPayments.reduce((sum, inv) => {
        const paidForInvoice = calculateTotalPaid(inv.payments);
        const remaining = Math.max(0, inv.amount - paidForInvoice);
        return sum + remaining;
      }, 0);

      const fullyPaidInvoices = invoicesWithPayments.filter(inv => {
        const paidForInvoice = calculateTotalPaid(inv.payments);
        return paidForInvoice >= inv.amount;
      }).length;

      const partiallyPaidInvoices = invoicesWithPayments.filter(inv => {
        const paidForInvoice = calculateTotalPaid(inv.payments);
        return paidForInvoice > 0 && paidForInvoice < inv.amount;
      }).length;

      const unpaidInvoices = invoicesWithPayments.filter(inv => {
        const paidForInvoice = calculateTotalPaid(inv.payments);
        return paidForInvoice === 0;
      }).length;

      const cashPayments = calculateTotalPaid(paymentsData?.filter(p => p.payment_method === 'نقدي') || []);
      const bankTransfers = calculateTotalPaid(paymentsData?.filter(p => p.payment_method === 'تحويل بنكي') || []);

      setDetailedStats({
        totalMerchants: merchantsCount || 0,
        activeMerchants: activeMerchantsCount || 0,
        totalInvoices: invoicesCount || 0,
        totalInvoiceAmount,
        totalPaid,
        totalRemaining,
        fullyPaidInvoices,
        partiallyPaidInvoices,
        unpaidInvoices,
        cashPayments,
        bankTransfers,
      });

    } catch (error: any) {
      console.error('Error loading detailed stats:', error);
      setError(error.message || 'حدث خطأ في تحميل الإحصائيات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetailedStats();
  }, []);





  // Statistics management functions
  const handleForceUpdate = async () => {
    setFixingSync(true);
    try {
      toast.info('جاري إجبار تحديث جميع الفواتير...');

      const result = await forceUpdateAllInvoices();

      if (result.success) {
        toast.success(`تم تحديث ${result.data?.success} فاتورة بنجاح من أصل ${result.data?.total}`);
        // إعادة تحميل الإحصائيات
        await loadDetailedStats();
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

      // محاولة الوصول لجدول المدفوعات
      const { error } = await supabase
        .from('payments')
        .select('id')
        .limit(1);

      if (error && error.code === 'PGRST116') {
        // الجدول غير موجود
        const sqlScript = `-- إصلاح سريع لخطأ المدفوعات
DROP TABLE IF EXISTS payments CASCADE;
DROP FUNCTION IF EXISTS update_invoice_amounts() CASCADE;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(12,2) DEFAULT 0.00;

UPDATE invoices SET paid_amount = 0.00, remaining_amount = amount;

CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    invoice_id VARCHAR(50) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    merchant_id BIGINT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20) DEFAULT 'نقدي',
    payment_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on payments" ON payments FOR ALL USING (true);

CREATE OR REPLACE FUNCTION update_invoice_amounts()
RETURNS TRIGGER AS $$
DECLARE
    total_paid DECIMAL(12,2) := 0;
    invoice_amount DECIMAL(12,2) := 0;
    remaining DECIMAL(12,2) := 0;
    new_status VARCHAR(20);
    target_invoice_id VARCHAR(50);
BEGIN
    IF TG_OP = 'DELETE' THEN target_invoice_id := OLD.invoice_id;
    ELSE target_invoice_id := NEW.invoice_id; END IF;

    SELECT COALESCE(SUM(amount), 0) INTO total_paid FROM payments WHERE invoice_id = target_invoice_id;
    SELECT amount INTO invoice_amount FROM invoices WHERE id = target_invoice_id;
    remaining := GREATEST(0, invoice_amount - total_paid);

    IF total_paid = 0 THEN new_status := 'معلقة';
    ELSIF total_paid >= invoice_amount THEN new_status := 'مدفوعة';
    ELSE new_status := 'مدفوعة جزئياً'; END IF;

    UPDATE invoices SET paid_amount = total_paid, remaining_amount = remaining, status = new_status WHERE id = target_invoice_id;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_insert_trigger AFTER INSERT ON payments FOR EACH ROW EXECUTE FUNCTION update_invoice_amounts();
CREATE TRIGGER payments_update_trigger AFTER UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_invoice_amounts();
CREATE TRIGGER payments_delete_trigger AFTER DELETE ON payments FOR EACH ROW EXECUTE FUNCTION update_invoice_amounts();`;

        navigator.clipboard.writeText(sqlScript);
        toast.error('جدول المدفوعات غير موجود! تم نسخ الكود - يرجى تشغيله في Supabase SQL Editor');

        alert(`جدول المدفوعات غير موجود!

يرجى اتباع هذه الخطوات:
1. اذهب إلى Supabase Dashboard
2. افتح SQL Editor
3. الصق الكود المنسوخ وشغله
4. ارجع هنا وجرب إضافة دفعة

تم نسخ الكود إلى الحافظة!`);

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

  // Get recent invoices (last 5)
  const recentInvoices = invoices
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "مدفوعة":
        return "bg-success/10 text-success border-success/20";
      case "معلقة":
        return "bg-warning/10 text-warning border-warning/20";
      case "ملغاة":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">لوحة التحكم</h1>
          <p className="text-muted-foreground">نظرة عامة على أداء الأعمال</p>
        </div>
        <div className="flex items-center space-x-2 space-x-reverse text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>اليوم: {new Date().toLocaleDateString('ar-EG')}</span>
        </div>
      </div>



      {/* Detailed Statistics Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">الإحصائيات التفصيلية</h2>
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

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="mr-2">جاري تحميل الإحصائيات...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-500 mb-4">❌ {error}</div>
            <Button onClick={loadDetailedStats} variant="outline">
              إعادة المحاولة
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="إجمالي التجار"
              value={detailedStats.totalMerchants.toString()}
              change={`${detailedStats.activeMerchants} تاجر نشط`}
              icon={Users}
              trend="up"
            />
            <StatsCard
              title="إجمالي الفواتير"
              value={detailedStats.totalInvoices.toString()}
              change={`${formatCurrency(detailedStats.totalInvoiceAmount)} ج.م`}
              icon={FileText}
              trend="up"
            />
            <StatsCard
              title="إجمالي المدفوع"
              value={`${formatCurrency(detailedStats.totalPaid)} ج.م`}
              change={`${detailedStats.fullyPaidInvoices} فاتورة مدفوعة`}
              icon={Banknote}
              trend="up"
            />
            <StatsCard
              title="إجمالي المتبقي"
              value={`${formatCurrency(detailedStats.totalRemaining)} ج.م`}
              change={`${detailedStats.unpaidInvoices} فاتورة معلقة`}
              icon={CreditCard}
              trend="down"
            />
          </div>
        )}

        {/* Payment Status Breakdown */}
        {!loading && !error && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-600">الفواتير المدفوعة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{detailedStats.fullyPaidInvoices}</div>
                <p className="text-xs text-muted-foreground">
                  {detailedStats.totalInvoices > 0
                    ? `${Math.round((detailedStats.fullyPaidInvoices / detailedStats.totalInvoices) * 100)}% من إجمالي الفواتير`
                    : 'لا توجد فواتير'
                  }
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-600">الفواتير الجزئية</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{detailedStats.partiallyPaidInvoices}</div>
                <p className="text-xs text-muted-foreground">
                  {detailedStats.totalInvoices > 0
                    ? `${Math.round((detailedStats.partiallyPaidInvoices / detailedStats.totalInvoices) * 100)}% من إجمالي الفواتير`
                    : 'لا توجد فواتير'
                  }
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-600">الفواتير المعلقة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{detailedStats.unpaidInvoices}</div>
                <p className="text-xs text-muted-foreground">
                  {detailedStats.totalInvoices > 0
                    ? `${Math.round((detailedStats.unpaidInvoices / detailedStats.totalInvoices) * 100)}% من إجمالي الفواتير`
                    : 'لا توجد فواتير'
                  }
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Payment Methods Breakdown */}
        {!loading && !error && (detailedStats.cashPayments > 0 || detailedStats.bankTransfers > 0) && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">المدفوعات النقدية</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(detailedStats.cashPayments)} ج.م</div>
                <p className="text-xs text-muted-foreground">
                  {detailedStats.totalPaid > 0
                    ? `${Math.round((detailedStats.cashPayments / detailedStats.totalPaid) * 100)}% من إجمالي المدفوعات`
                    : 'لا توجد مدفوعات'
                  }
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">التحويلات البنكية</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(detailedStats.bankTransfers)} ج.م</div>
                <p className="text-xs text-muted-foreground">
                  {detailedStats.totalPaid > 0
                    ? `${Math.round((detailedStats.bankTransfers / detailedStats.totalPaid) * 100)}% من إجمالي المدفوعات`
                    : 'لا توجد مدفوعات'
                  }
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="grid gap-6">
        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 space-x-reverse">
              <FileText className="h-5 w-5" />
              <span>آخر الفواتير</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoicesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {recentInvoices.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">لا توجد فواتير</h3>
                    <p className="text-muted-foreground">لم يتم إنشاء أي فواتير بعد</p>
                  </div>
                ) : (
                  recentInvoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{invoice.merchant_name}</span>
                          <span className="text-sm text-muted-foreground">{new Date(invoice.date).toLocaleDateString('ar-EG')}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{invoice.id}</span>
                          <span className="font-semibold">{invoice.amount.toLocaleString()} ج.م</span>
                        </div>
                      </div>
                      <div className="mr-3">
                        <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;