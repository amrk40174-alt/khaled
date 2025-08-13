// سكريبت لاستعادة البيانات إلى مشروع Supabase جديد
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// سيتم تحديث هذه القيم بعد إنشاء المشروع الجديد
const NEW_SUPABASE_URL = process.env.NEW_SUPABASE_URL || 'YOUR_NEW_SUPABASE_URL'
const NEW_SUPABASE_KEY = process.env.NEW_SUPABASE_KEY || 'YOUR_NEW_SUPABASE_KEY'

async function restoreData() {
  console.log('🔄 بدء عملية استعادة البيانات...')
  
  // التحقق من وجود بيانات الاتصال الجديدة
  if (NEW_SUPABASE_URL === 'YOUR_NEW_SUPABASE_URL' || NEW_SUPABASE_KEY === 'YOUR_NEW_SUPABASE_KEY') {
    console.error('❌ يرجى تحديث بيانات الاتصال الجديدة أولاً')
    console.log('💡 قم بتحديث المتغيرات NEW_SUPABASE_URL و NEW_SUPABASE_KEY')
    return
  }

  const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY)

  try {
    // قراءة ملف النسخة الاحتياطية
    const backupFile = './backup/latest-backup.json'
    if (!fs.existsSync(backupFile)) {
      throw new Error('ملف النسخة الاحتياطية غير موجود')
    }

    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'))
    console.log('📁 تم تحميل النسخة الاحتياطية بنجاح')
    console.log(`📊 البيانات المتاحة:`)
    console.log(`   👥 التجار: ${backupData.data.merchants?.length || 0}`)
    console.log(`   📋 الفواتير: ${backupData.data.invoices?.length || 0}`)
    console.log(`   💰 المدفوعات: ${backupData.data.payments?.length || 0}`)

    // 1. استعادة التجار
    if (backupData.data.merchants && backupData.data.merchants.length > 0) {
      console.log('\n👥 استعادة بيانات التجار...')
      
      for (const merchant of backupData.data.merchants) {
        // إزالة الحقول التي يتم إنشاؤها تلقائياً
        const { id, created_at, updated_at, ...merchantData } = merchant
        
        const { error } = await supabase
          .from('merchants')
          .insert([merchantData])

        if (error) {
          console.error(`❌ خطأ في إدراج التاجر ${merchant.name}:`, error)
        } else {
          console.log(`✅ تم استعادة التاجر: ${merchant.name}`)
        }
      }
    }

    // 2. استعادة الفواتير
    if (backupData.data.invoices && backupData.data.invoices.length > 0) {
      console.log('\n📋 استعادة بيانات الفواتير...')
      
      for (const invoice of backupData.data.invoices) {
        // إزالة الحقول التي يتم إنشاؤها تلقائياً
        const { created_at, updated_at, ...invoiceData } = invoice
        
        const { error } = await supabase
          .from('invoices')
          .insert([invoiceData])

        if (error) {
          console.error(`❌ خطأ في إدراج الفاتورة ${invoice.id}:`, error)
        } else {
          console.log(`✅ تم استعادة الفاتورة: ${invoice.id}`)
        }
      }
    }

    // 3. استعادة المدفوعات
    if (backupData.data.payments && backupData.data.payments.length > 0) {
      console.log('\n💰 استعادة بيانات المدفوعات...')
      
      for (const payment of backupData.data.payments) {
        // إزالة الحقول التي يتم إنشاؤها تلقائياً
        const { id, created_at, updated_at, ...paymentData } = payment
        
        const { error } = await supabase
          .from('payments')
          .insert([paymentData])

        if (error) {
          console.error(`❌ خطأ في إدراج الدفعة ${payment.id}:`, error)
        } else {
          console.log(`✅ تم استعادة الدفعة: ${payment.amount} جنيه`)
        }
      }
    }

    console.log('\n🎉 تمت عملية استعادة البيانات بنجاح!')
    
    // التحقق من البيانات المستعادة
    console.log('\n🔍 التحقق من البيانات المستعادة...')
    
    const { data: restoredMerchants } = await supabase.from('merchants').select('*')
    const { data: restoredInvoices } = await supabase.from('invoices').select('*')
    const { data: restoredPayments } = await supabase.from('payments').select('*')
    
    console.log(`✅ التجار المستعادة: ${restoredMerchants?.length || 0}`)
    console.log(`✅ الفواتير المستعادة: ${restoredInvoices?.length || 0}`)
    console.log(`✅ المدفوعات المستعادة: ${restoredPayments?.length || 0}`)

  } catch (error) {
    console.error('❌ خطأ في عملية الاستعادة:', error)
    throw error
  }
}

// تشغيل السكريبت
if (process.argv.includes('--run')) {
  restoreData()
    .then(() => {
      console.log('\n✅ انتهت عملية الاستعادة بنجاح')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ فشلت عملية الاستعادة:', error)
      process.exit(1)
    })
} else {
  console.log('💡 لتشغيل السكريبت، استخدم: bun restore-data.js --run')
  console.log('⚠️  تأكد من تحديث بيانات الاتصال الجديدة أولاً')
}
