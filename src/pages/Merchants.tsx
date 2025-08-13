import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/utils/calculations";
import {
  Plus,
  Search,
  Phone,
  MapPin,
  Edit,
  Trash2,
  User,
  Mail,
  Calendar,
  Filter,
  Loader2
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMerchantsWithStats, useCreateMerchant, useDeleteMerchant } from "@/hooks/useMerchants";

const Merchants = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    category: "تجزئة" as const,
    status: "نشط" as const
  });

  // Hooks
  const { data: merchants = [], isLoading, error } = useMerchantsWithStats();
  const createMerchant = useCreateMerchant();
  const deleteMerchant = useDeleteMerchant();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createMerchant.mutateAsync({
        ...formData,
        join_date: new Date().toISOString().split('T')[0],
        total_invoices: 0,
        total_amount: 0
      });

      setFormData({
        name: "",
        email: "",
        phone: "",
        address: "",
        category: "تجزئة",
        status: "نشط"
      });
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error creating merchant:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('هل أنت متأكد من حذف هذا التاجر؟')) {
      try {
        await deleteMerchant.mutateAsync(id);
      } catch (error) {
        console.error('Error deleting merchant:', error);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "نشط":
        return "bg-success/10 text-success border-success/20";
      case "معلق":
        return "bg-warning/10 text-warning border-warning/20";
      case "غير نشط":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const filteredMerchants = merchants.filter(merchant => {
    const matchesSearch = merchant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         merchant.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         merchant.phone.includes(searchTerm);
    const matchesStatus = selectedStatus === "all" || merchant.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2">حدث خطأ</h3>
          <p className="text-muted-foreground">فشل في تحميل بيانات التجار</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">إدارة التجار</h1>
          <p className="text-muted-foreground">إدارة وعرض جميع التجار المسجلين</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 ml-2" />
              إضافة تاجر جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>إضافة تاجر جديد</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">الاسم</Label>
                <Input
                  id="name"
                  placeholder="اسم التاجر"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">رقم الهاتف</Label>
                <Input
                  id="phone"
                  placeholder="+20 xxx xxx xxxx"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">الفئة</Label>
                <Select value={formData.category} onValueChange={(value: any) => setFormData({...formData, category: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الفئة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="تجزئة">تجزئة</SelectItem>
                    <SelectItem value="جملة">جملة</SelectItem>
                    <SelectItem value="خدمات">خدمات</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">العنوان</Label>
                <Textarea
                  id="address"
                  placeholder="عنوان التاجر"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={createMerchant.isPending}>
                {createMerchant.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري الإضافة...
                  </>
                ) : (
                  'إضافة التاجر'
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="البحث بالاسم، البريد الإلكتروني، أو رقم الهاتف..."
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
              <SelectItem value="نشط">نشط</SelectItem>
              <SelectItem value="معلق">معلق</SelectItem>
              <SelectItem value="غير نشط">غير نشط</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}

      {/* Merchants Grid */}
      {!isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMerchants.map((merchant) => (
            <Card key={merchant.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3 space-x-reverse">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{merchant.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{merchant.category}</p>
                  </div>
                </div>
                <Badge className={getStatusColor(merchant.status)}>
                  {merchant.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 ml-2" />
                  <span>{merchant.email}</span>
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 ml-2" />
                  <span>{merchant.phone}</span>
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 ml-2" />
                  <span>{merchant.address}</span>
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 ml-2" />
                  <span>انضم في: {new Date(merchant.join_date).toLocaleDateString('ar-EG')}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                <div className="text-center">
                  <p className="text-lg font-semibold">{merchant.totalInvoices || 0}</p>
                  <p className="text-xs text-muted-foreground">إجمالي الفواتير</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold">{(merchant.totalAmount || 0).toLocaleString()} ج.م</p>
                  <p className="text-xs text-muted-foreground">إجمالي المبلغ</p>
                </div>
              </div>

              {/* Payment Statistics */}
              {merchant.totalInvoices > 0 && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-green-600">{formatCurrency(merchant.totalPaid || 0)} ج.م</p>
                    <p className="text-xs text-muted-foreground">المبلغ المدفوع</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-red-600">{formatCurrency(merchant.totalRemaining || 0)} ج.م</p>
                    <p className="text-xs text-muted-foreground">المبلغ المستحق</p>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end space-x-2 space-x-reverse pt-2">
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(merchant.id)}
                  disabled={deleteMerchant.isPending}
                >
                  {deleteMerchant.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
          ))}
        </div>
      )}

      {filteredMerchants.length === 0 && (
        <div className="text-center py-12">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">لا توجد نتائج</h3>
          <p className="text-muted-foreground">لم يتم العثور على تجار يطابقون البحث</p>
        </div>
      )}
    </div>
  );
};

export default Merchants;