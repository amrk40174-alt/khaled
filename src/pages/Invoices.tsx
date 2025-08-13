import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/utils/calculations";
import {
  Plus,
  Search,
  Download,
  Eye,
  Edit,
  Trash2,
  Calendar,
  Filter,
  FileText,
  Printer,
  Loader2,
  Minus,
  User,
  Phone,
  CreditCard
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInvoices, useCreateInvoice, useDeleteInvoice } from "@/hooks/useInvoices";
import { useMerchants } from "@/hooks/useMerchants";
import type { InvoiceItem, Invoice } from "@/lib/supabase";
import InvoiceDetails from "@/components/InvoiceDetails";
import EditInvoice from "@/components/EditInvoice";
import PaymentDialog from "@/components/PaymentDialog";

const Invoices = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formData, setFormData] = useState({
    merchant_id: "",
    due_date: "",
    items: [{ name: "", quantity: 1, price: 0 }] as InvoiceItem[]
  });

  // Hooks
  const { data: invoices = [], isLoading: invoicesLoading, error } = useInvoices();
  const { data: merchants = [] } = useMerchants();
  const createInvoice = useCreateInvoice();
  const deleteInvoice = useDeleteInvoice();

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { name: "", quantity: 1, price: 0 }]
    });
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      setFormData({
        ...formData,
        items: formData.items.filter((_, i) => i !== index)
      });
    }
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const updatedItems = [...formData.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setFormData({ ...formData, items: updatedItems });
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.merchant_id || !formData.due_date) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    const selectedMerchant = merchants.find(m => m.id.toString() === formData.merchant_id);
    if (!selectedMerchant) {
      alert('يرجى اختيار تاجر صحيح');
      return;
    }

    try {
      // Generate sequential invoice number based on existing invoices
      const existingNumbers = invoices
        .map(inv => inv.id)
        .filter(id => id.startsWith('INV-'))
        .map(id => parseInt(id.replace('INV-', '')) || 0)
        .filter(num => !isNaN(num));

      const nextInvoiceNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      const invoiceId = `INV-${nextInvoiceNumber.toString().padStart(3, '0')}`;

      await createInvoice.mutateAsync({
        id: invoiceId,
        merchant_id: parseInt(formData.merchant_id),
        merchant_name: selectedMerchant.name,
        merchant_phone: selectedMerchant.phone,
        amount: calculateTotal(),
        status: 'مسودة',
        date: new Date().toISOString().split('T')[0],
        due_date: formData.due_date,
        items: formData.items
      });

      setFormData({
        merchant_id: "",
        due_date: "",
        items: [{ name: "", quantity: 1, price: 0 }]
      });
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error creating invoice:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) {
      try {
        await deleteInvoice.mutateAsync(id);
      } catch (error) {
        console.error('Error deleting invoice:', error);
      }
    }
  };

  const handleViewDetails = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsDetailsOpen(true);
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsEditOpen(true);
  };

  const handlePrintInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsDetailsOpen(true);
    // Print will be handled by InvoiceDetails component
  };

  const handleDownloadInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsDetailsOpen(true);
    // Download will be handled by InvoiceDetails component
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "مدفوعة":
        return "bg-success/10 text-success border-success/20";
      case "مدفوعة جزئياً":
        return "bg-blue/10 text-blue-600 border-blue/20";
      case "معلقة":
        return "bg-warning/10 text-warning border-warning/20";
      case "متأخرة":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "مسودة":
        return "bg-muted/10 text-muted-foreground border-muted/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.merchant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.merchant_phone.includes(searchTerm);
    const matchesStatus = selectedStatus === "all" || invoice.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2">حدث خطأ</h3>
          <p className="text-muted-foreground">فشل في تحميل بيانات الفواتير</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">إدارة الفواتير</h1>
          <p className="text-muted-foreground">إنشاء وإدارة جميع فواتير التجار</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 ml-2" />
              إنشاء فاتورة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>إنشاء فاتورة جديدة</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="merchant">التاجر</Label>
                  <Select value={formData.merchant_id} onValueChange={(value) => setFormData({...formData, merchant_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر التاجر" />
                    </SelectTrigger>
                    <SelectContent>
                      {merchants.length === 0 ? (
                        <SelectItem value="" disabled>لا توجد تجار مسجلين</SelectItem>
                      ) : (
                        merchants.map((merchant) => (
                          <SelectItem key={merchant.id} value={merchant.id.toString()}>
                            {merchant.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">تاريخ الاستحقاق</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">عناصر الفاتورة</h3>
                  <Button type="button" onClick={addItem} variant="outline" size="sm">
                    <Plus className="h-4 w-4 ml-1" />
                    إضافة عنصر
                  </Button>
                </div>

                <div className="space-y-2">
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-5 gap-2 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">اسم المنتج/الخدمة</Label>
                        <Input
                          placeholder="اسم المنتج"
                          value={item.name}
                          onChange={(e) => updateItem(index, 'name', e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">الكمية</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">السعر (ج.م)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">المجموع</Label>
                        <div className="h-10 flex items-center px-3 bg-muted rounded-md text-sm">
                          {(item.quantity * item.price).toFixed(2)} ج.م
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs opacity-0">حذف</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeItem(index)}
                          disabled={formData.items.length === 1}
                          className="h-10"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <span className="font-medium text-lg">الإجمالي: {calculateTotal().toFixed(2)} ج.م</span>
                <div className="space-x-2 space-x-reverse">
                  <Button type="submit" disabled={createInvoice.isPending}>
                    {createInvoice.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        جاري الإنشاء...
                      </>
                    ) : (
                      'إنشاء الفاتورة'
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="البحث برقم الفاتورة، اسم التاجر، أو رقم الهاتف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="مدفوعة">مدفوعة</SelectItem>
              <SelectItem value="مدفوعة جزئياً">مدفوعة جزئياً</SelectItem>
              <SelectItem value="معلقة">معلقة</SelectItem>
              <SelectItem value="متأخرة">متأخرة</SelectItem>
              <SelectItem value="مسودة">مسودة</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 space-x-reverse">
            <FileText className="h-5 w-5" />
            <span>قائمة الفواتير</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors">
                  <div className="flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <p className="font-medium text-sm text-muted-foreground">رقم الفاتورة</p>
                        <p className="font-semibold">{invoice.id}</p>
                      </div>
                      <div>
                        <p className="font-medium text-sm text-muted-foreground">التاجر</p>
                        <p className="font-semibold">{invoice.merchant_name}</p>
                        <p className="text-sm text-muted-foreground">{invoice.merchant_phone}</p>
                      </div>
                      <div>
                        <p className="font-medium text-sm text-muted-foreground">التواريخ</p>
                        <p className="text-sm">تاريخ الإنشاء: {new Date(invoice.date).toLocaleDateString('ar-EG')}</p>
                        <p className="text-sm">تاريخ الاستحقاق: {new Date(invoice.due_date).toLocaleDateString('ar-EG')}</p>
                      </div>
                      <div>
                        <p className="font-medium text-sm text-muted-foreground">المبلغ والحالة</p>
                        <p className="font-bold text-lg">{formatCurrency(invoice.amount)} ج.م</p>
                        <div className="text-xs space-y-1 mt-1">
                          <p className="text-green-600">مدفوع: {formatCurrency(invoice.paid_amount || 0)} ج.م</p>
                          <p className="text-red-600">متبقي: {formatCurrency(invoice.remaining_amount || invoice.amount)} ج.م</p>
                        </div>
                        <Badge className={getStatusColor(invoice.status)}>
                          {invoice.status}
                        </Badge>
                      </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 space-x-reverse mr-4">
                  <Button
                    variant="outline"
                    size="sm"
                    title="عرض التفاصيل"
                    onClick={() => handleViewDetails(invoice)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {invoice.remaining_amount > 0 && (
                    <PaymentDialog invoice={invoice}>
                      <Button
                        variant="outline"
                        size="sm"
                        title="إضافة دفعة"
                        className="text-green-600 hover:text-green-600"
                      >
                        <CreditCard className="h-4 w-4" />
                      </Button>
                    </PaymentDialog>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    title="طباعة"
                    onClick={() => handlePrintInvoice(invoice)}
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    title="تحميل PDF"
                    onClick={() => handleDownloadInvoice(invoice)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    title="تعديل"
                    onClick={() => handleEditInvoice(invoice)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    title="حذف"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(invoice.id)}
                    disabled={deleteInvoice.isPending}
                  >
                    {deleteInvoice.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              ))}
            </div>
          )}

          {!invoicesLoading && filteredInvoices.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">لا توجد فواتير</h3>
              <p className="text-muted-foreground">
                {invoices.length === 0 ? "لم يتم إنشاء أي فواتير بعد" : "لم يتم العثور على فواتير تطابق البحث"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Details Modal */}
      <InvoiceDetails
        invoice={selectedInvoice}
        open={isDetailsOpen}
        onOpenChange={(open) => {
          setIsDetailsOpen(open);
          if (!open) {
            setSelectedInvoice(null);
          }
        }}
      />

      {/* Edit Invoice Modal */}
      <EditInvoice
        invoice={selectedInvoice}
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedInvoice(null);
        }}
      />
    </div>
  );
};

export default Invoices;