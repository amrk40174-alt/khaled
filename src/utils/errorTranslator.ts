// دالة لترجمة رسائل الخطأ من الإنجليزية إلى العربية

export const translateError = (error: any): string => {
  if (!error?.message) {
    return '❌ حدث خطأ غير معروف';
  }

  const message = error.message.toLowerCase();
  const code = error.code?.toLowerCase() || '';

  // أخطاء قاعدة البيانات الشائعة
  if (message.includes('foreign key') || message.includes('violates foreign key constraint')) {
    return '❌ خطأ في ربط البيانات - الجدول غير مرتبط بشكل صحيح\n💡 الحل: اذهب إلى الإحصائيات وانقر "إصلاح سريع"';
  }

  if (message.includes('does not exist') || (message.includes('relation') && message.includes('does not exist'))) {
    return '❌ الجدول المطلوب غير موجود في قاعدة البيانات\n💡 الحل: اذهب إلى الإحصائيات وانقر "إصلاح سريع"';
  }

  if (message.includes('violates check constraint') || message.includes('check constraint')) {
    return '❌ البيانات المدخلة غير صحيحة - تأكد من أن المبلغ أكبر من صفر';
  }

  if (message.includes('null value') || message.includes('not null constraint')) {
    return '❌ بيانات مطلوبة مفقودة - تأكد من ملء جميع الحقول المطلوبة';
  }

  if (message.includes('duplicate key') || message.includes('unique constraint')) {
    return '❌ هذه البيانات موجودة بالفعل - لا يمكن إضافة نسخة مكررة';
  }

  if (message.includes('permission denied') || message.includes('insufficient privilege')) {
    return '❌ ليس لديك صلاحية لتنفيذ هذا الإجراء - تحقق من إعدادات الحساب';
  }

  // أخطاء الشبكة والاتصال
  if (message.includes('network') || message.includes('fetch failed') || message.includes('connection')) {
    return '❌ مشكلة في الاتصال بالإنترنت\n💡 تحقق من الاتصال وحاول مرة أخرى';
  }

  if (message.includes('timeout') || message.includes('timed out')) {
    return '❌ انتهت مهلة الاتصال\n💡 حاول مرة أخرى بعد قليل';
  }

  if (message.includes('server error') || message.includes('internal server error') || code === '500') {
    return '❌ مشكلة في الخادم\n💡 حاول مرة أخرى بعد دقائق قليلة';
  }

  if (message.includes('unauthorized') || code === '401') {
    return '❌ غير مصرح لك بالوصول\n💡 تحقق من تسجيل الدخول';
  }

  if (message.includes('forbidden') || code === '403') {
    return '❌ ممنوع - ليس لديك صلاحية\n💡 تحقق من إعدادات الحساب';
  }

  if (message.includes('not found') || code === '404') {
    return '❌ البيانات المطلوبة غير موجودة\n💡 تأكد من صحة البيانات المدخلة';
  }

  if (message.includes('bad request') || code === '400') {
    return '❌ طلب غير صحيح - تحقق من البيانات المدخلة';
  }

  // أخطاء Supabase المحددة
  if (code === 'pgrst116') {
    return '❌ الجدول أو العمود غير موجود\n💡 الحل: اذهب إلى الإحصائيات وانقر "إصلاح سريع"';
  }

  if (code === 'pgrst301') {
    return '❌ خطأ في صيغة الاستعلام - البيانات غير صحيحة';
  }

  if (message.includes('jwt') || message.includes('token')) {
    return '❌ انتهت صلاحية جلسة العمل\n💡 أعد تحميل الصفحة وسجل الدخول مرة أخرى';
  }

  // أخطاء التحقق من البيانات
  if (message.includes('invalid input') || message.includes('syntax error')) {
    return '❌ البيانات المدخلة غير صحيحة - تحقق من الصيغة';
  }

  if (message.includes('out of range') || message.includes('numeric value out of range')) {
    return '❌ الرقم المدخل كبير جداً أو صغير جداً';
  }

  if (message.includes('invalid date') || message.includes('date format')) {
    return '❌ تاريخ غير صحيح - تحقق من صيغة التاريخ';
  }

  // أخطاء عامة أخرى
  if (message.includes('cors')) {
    return '❌ مشكلة في إعدادات الأمان\n💡 تحقق من إعدادات المتصفح';
  }

  if (message.includes('quota') || message.includes('limit exceeded')) {
    return '❌ تم تجاوز الحد المسموح\n💡 حاول مرة أخرى لاحقاً';
  }

  if (message.includes('maintenance') || message.includes('service unavailable')) {
    return '❌ الخدمة غير متاحة حالياً للصيانة\n💡 حاول مرة أخرى لاحقاً';
  }

  // إذا لم نجد ترجمة محددة، نعرض رسالة مبسطة
  if (error.message.length > 100) {
    return '❌ حدث خطأ في النظام\n💡 حاول مرة أخرى أو اتصل بالدعم الفني';
  }

  // عرض الرسالة الأصلية إذا كانت قصيرة ومفهومة
  return `❌ خطأ: ${error.message}`;
};

// دالة مساعدة لعرض رسائل الخطأ مع اقتراحات الحلول
export const showUserFriendlyError = (error: any, context: string = '') => {
  const translatedMessage = translateError(error);
  
  // إضافة السياق إذا كان متوفراً
  let fullMessage = translatedMessage;
  if (context) {
    fullMessage = `${context}\n\n${translatedMessage}`;
  }

  return fullMessage;
};

// قاموس للرسائل الشائعة
export const commonErrorMessages = {
  networkError: '❌ مشكلة في الاتصال بالإنترنت - تحقق من الاتصال',
  serverError: '❌ مشكلة في الخادم - حاول مرة أخرى لاحقاً',
  permissionDenied: '❌ ليس لديك صلاحية لتنفيذ هذا الإجراء',
  dataNotFound: '❌ البيانات المطلوبة غير موجودة',
  invalidInput: '❌ البيانات المدخلة غير صحيحة',
  duplicateData: '❌ هذه البيانات موجودة بالفعل',
  missingData: '❌ بيانات مطلوبة مفقودة',
  databaseError: '❌ خطأ في قاعدة البيانات - اتصل بالدعم الفني',
  sessionExpired: '❌ انتهت صلاحية جلسة العمل - أعد تسجيل الدخول',
  quotaExceeded: '❌ تم تجاوز الحد المسموح - حاول لاحقاً'
};
