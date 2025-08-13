import Decimal from 'decimal.js';

// إعداد Decimal للعمليات الحسابية الدقيقة
Decimal.config({
  precision: 10,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -7,
  toExpPos: 21,
});

// دالة لتحويل الرقم إلى Decimal بأمان
export const toDecimal = (value: number | string | null | undefined): Decimal => {
  if (value === null || value === undefined || value === '') {
    return new Decimal(0);
  }
  try {
    return new Decimal(value);
  } catch {
    return new Decimal(0);
  }
};

// دالة لتحويل Decimal إلى رقم للعرض
export const toNumber = (decimal: Decimal): number => {
  return decimal.toNumber();
};

// دالة لحساب إجمالي المدفوعات لفاتورة
export const calculateTotalPaid = (payments: Array<{ amount: number }>): number => {
  if (!payments || payments.length === 0) {
    return 0;
  }
  
  const total = payments.reduce((sum, payment) => {
    return sum.plus(toDecimal(payment.amount));
  }, new Decimal(0));
  
  return toNumber(total);
};

// دالة لحساب المبلغ المتبقي
export const calculateRemaining = (invoiceAmount: number, paidAmount: number): number => {
  const invoice = toDecimal(invoiceAmount);
  const paid = toDecimal(paidAmount);
  const remaining = invoice.minus(paid);
  
  // التأكد من أن المتبقي لا يقل عن صفر
  return Math.max(0, toNumber(remaining));
};

// دالة لتحديد حالة الفاتورة
export const getInvoiceStatus = (invoiceAmount: number, paidAmount: number, currentStatus?: string): string => {
  // لا تغير حالة المسودة أو الملغاة
  if (currentStatus === 'مسودة' || currentStatus === 'ملغاة') {
    return currentStatus;
  }
  
  const invoice = toDecimal(invoiceAmount);
  const paid = toDecimal(paidAmount);
  
  if (paid.equals(0)) {
    return 'معلقة';
  } else if (paid.greaterThanOrEqualTo(invoice)) {
    return 'مدفوعة';
  } else {
    return 'مدفوعة جزئياً';
  }
};

// دالة لحساب إحصائيات التاجر
export const calculateMerchantStats = (invoices: Array<{
  amount: number;
  paid_amount?: number;
  payments?: Array<{ amount: number }>;
}>) => {
  let totalInvoices = 0;
  let totalAmount = new Decimal(0);
  let totalPaid = new Decimal(0);
  let totalRemaining = new Decimal(0);
  
  invoices.forEach(invoice => {
    totalInvoices++;
    const invoiceAmount = toDecimal(invoice.amount);
    totalAmount = totalAmount.plus(invoiceAmount);
    
    // حساب المدفوع من المدفوعات أو من الحقل المحفوظ
    let paidAmount = new Decimal(0);
    if (invoice.payments && invoice.payments.length > 0) {
      paidAmount = invoice.payments.reduce((sum, payment) => {
        return sum.plus(toDecimal(payment.amount));
      }, new Decimal(0));
    } else if (invoice.paid_amount) {
      paidAmount = toDecimal(invoice.paid_amount);
    }
    
    totalPaid = totalPaid.plus(paidAmount);
    
    const remaining = invoiceAmount.minus(paidAmount);
    totalRemaining = totalRemaining.plus(remaining.greaterThan(0) ? remaining : new Decimal(0));
  });
  
  return {
    totalInvoices,
    totalAmount: toNumber(totalAmount),
    totalPaid: toNumber(totalPaid),
    totalRemaining: toNumber(totalRemaining),
  };
};

// دالة لحساب الإحصائيات العامة
export const calculateOverallStats = (merchants: Array<{
  invoices: Array<{
    amount: number;
    paid_amount?: number;
    payments?: Array<{ amount: number }>;
  }>;
}>) => {
  let totalInvoices = 0;
  let totalAmount = new Decimal(0);
  let totalPaid = new Decimal(0);
  let totalRemaining = new Decimal(0);
  
  merchants.forEach(merchant => {
    const stats = calculateMerchantStats(merchant.invoices);
    totalInvoices += stats.totalInvoices;
    totalAmount = totalAmount.plus(toDecimal(stats.totalAmount));
    totalPaid = totalPaid.plus(toDecimal(stats.totalPaid));
    totalRemaining = totalRemaining.plus(toDecimal(stats.totalRemaining));
  });
  
  return {
    totalInvoices,
    totalAmount: toNumber(totalAmount),
    totalPaid: toNumber(totalPaid),
    totalRemaining: toNumber(totalRemaining),
  };
};

// دالة لتنسيق الأرقام للعرض
export const formatCurrency = (amount: number): string => {
  const decimal = toDecimal(amount);
  return decimal.toFixed(2);
};

// دالة للتحقق من صحة المبلغ
export const isValidAmount = (amount: number | string): boolean => {
  try {
    const decimal = toDecimal(amount);
    return decimal.greaterThan(0) && decimal.isFinite();
  } catch {
    return false;
  }
};

// دالة لحساب النسبة المئوية للمدفوع
export const calculatePaymentPercentage = (invoiceAmount: number, paidAmount: number): number => {
  const invoice = toDecimal(invoiceAmount);
  const paid = toDecimal(paidAmount);
  
  if (invoice.equals(0)) {
    return 0;
  }
  
  const percentage = paid.dividedBy(invoice).times(100);
  return Math.min(100, Math.max(0, toNumber(percentage)));
};

// دالة لتجميع المدفوعات حسب التاريخ
export const groupPaymentsByDate = (payments: Array<{
  amount: number;
  payment_date: string;
}>) => {
  const grouped: { [date: string]: number } = {};
  
  payments.forEach(payment => {
    const date = payment.payment_date;
    if (!grouped[date]) {
      grouped[date] = 0;
    }
    grouped[date] = toNumber(toDecimal(grouped[date]).plus(toDecimal(payment.amount)));
  });
  
  return grouped;
};

// دالة لحساب متوسط المدفوعات
export const calculateAveragePayment = (payments: Array<{ amount: number }>): number => {
  if (!payments || payments.length === 0) {
    return 0;
  }
  
  const total = calculateTotalPaid(payments);
  return toNumber(toDecimal(total).dividedBy(payments.length));
};
