import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus, Loader2 } from "lucide-react";
import { useUpdateInvoice } from "@/hooks/useInvoices";
import { useMerchants } from "@/hooks/useMerchants";
import type { Invoice, InvoiceItem } from "@/lib/supabase";

interface EditInvoiceProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
}

const EditInvoice = ({ invoice, isOpen, onClose }: EditInvoiceProps) => {
  const [formData, setFormData] = useState({
    merchant_id: "",
    status: "مسودة" as const,
    due_date: "",
    items: [{ name: "", quantity: 1, price: 0 }] as InvoiceItem[]
  });

  const { data: merchants = [] } = useMerchants();
  const updateInvoice = useUpdateInvoice();

  useEffect(() => {
    if (invoice) {
      // Try to parse items from description
      let items = [{ name: "", quantity: 1, price: 0 }];
      try {
        if (invoice.description) {
          const parsed = JSON.parse(invoice.description);
          if (Array.isArray(parsed) && parsed.length > 0) {
            items = parsed;
          }
        }
      } catch (e) {
        // Use default item if parsing fails
      }

      setFormData({
        merchant_id: invoice.merchant_id.toString(),
        status: invoice.status as any,
        due_date: invoice.due_date,
        items: items
      });
    }
  }, [invoice]);

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
    
    if (!invoice || !formData.merchant_id || !formData.due_date) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    const selectedMerchant = merchants.find(m => m.id.toString() === formData.merchant_id);
    if (!selectedMerchant) {
      alert('يرجى اختيار تاجر صحيح');
      return;
    }

    try {
      await updateInvoice.mutateAsync({
        id: invoice.id,
        updates: {
          merchant_id: parseInt(formData.merchant_id),
          merchant_name: selectedMerchant.name,
          merchant_phone: selectedMerchant.phone,
          amount: calculateTotal(),
          status: formData.status,
          due_date: formData.due_date,
          items: formData.items
        }
      });
      
      onClose();
    } catch (error) {
      console.error('Error updating invoice:', error);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تعديل الفاتورة {invoice.id}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <Label htmlFor="status">الحالة</Label>
              <Select value={formData.status} onValueChange={(value: any) => setFormData({...formData, status: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="مسودة">مسودة</SelectItem>
                  <SelectItem value="معلقة">معلقة</SelectItem>
                  <SelectItem value="مدفوعة">مدفوعة</SelectItem>
                  <SelectItem value="متأخرة">متأخرة</SelectItem>
                  <SelectItem value="ملغاة">ملغاة</SelectItem>
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
              <Button type="button" variant="outline" onClick={onClose}>
                إلغاء
              </Button>
              <Button type="submit" disabled={updateInvoice.isPending}>
                {updateInvoice.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري التحديث...
                  </>
                ) : (
                  'حفظ التغييرات'
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditInvoice;
