// سكريبت لأخذ نسخة احتياطية من جميع البيانات
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// قراءة متغيرات البيئة
const supabaseUrl = 'https://dxcogkddtggvylbqupaq.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4Y29na2RkdGdndnlsYnF1cGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODU1NDgsImV4cCI6MjA2OTY2MTU0OH0.YFRHuj97eACEUdNqyfigydG6n1my4LsjqrxTD9Yq_3o'

const supabase = createClient(supabaseUrl, supabaseKey)

async function backupData() {
  console.log('🔄 بدء عملية النسخ الاحتياطي...')
  
  const backupData = {
    timestamp: new Date().toISOString(),
    supabase_project: 'dxcogkddtggvylbqupaq',
    data: {}
  }

  try {
    // 1. نسخ احتياطية للتجار
    console.log('📊 تصدير بيانات التجار...')
    const { data: merchants, error: merchantsError } = await supabase
      .from('merchants')
      .select('*')
      .order('created_at', { ascending: true })

    if (merchantsError) {
      console.error('❌ خطأ في تصدير التجار:', merchantsError)
    } else {
      backupData.data.merchants = merchants || []
      console.log(`✅ تم تصدير ${merchants?.length || 0} تاجر`)
    }

    // 2. نسخ احتياطية للفواتير
    console.log('📋 تصدير بيانات الفواتير...')
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: true })

    if (invoicesError) {
      console.error('❌ خطأ في تصدير الفواتير:', invoicesError)
    } else {
      backupData.data.invoices = invoices || []
      console.log(`✅ تم تصدير ${invoices?.length || 0} فاتورة`)
    }

    // 3. نسخ احتياطية للمدفوعات
    console.log('💰 تصدير بيانات المدفوعات...')
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: true })

    if (paymentsError) {
      console.error('❌ خطأ في تصدير المدفوعات:', paymentsError)
      console.log('ℹ️  قد يكون جدول المدفوعات غير موجود - هذا طبيعي')
      backupData.data.payments = []
    } else {
      backupData.data.payments = payments || []
      console.log(`✅ تم تصدير ${payments?.length || 0} دفعة`)
    }

    // 4. حفظ النسخة الاحتياطية
    const backupDir = './backup'
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFile = path.join(backupDir, `backup-${timestamp}.json`)
    
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8')
    
    console.log('\n🎉 تمت عملية النسخ الاحتياطي بنجاح!')
    console.log(`📁 الملف: ${backupFile}`)
    console.log('\n📊 ملخص البيانات المحفوظة:')
    console.log(`   👥 التجار: ${backupData.data.merchants?.length || 0}`)
    console.log(`   📋 الفواتير: ${backupData.data.invoices?.length || 0}`)
    console.log(`   💰 المدفوعات: ${backupData.data.payments?.length || 0}`)
    
    // حفظ نسخة إضافية بتاريخ اليوم
    const todayBackup = path.join(backupDir, 'latest-backup.json')
    fs.writeFileSync(todayBackup, JSON.stringify(backupData, null, 2), 'utf8')
    console.log(`📁 نسخة إضافية: ${todayBackup}`)

    return backupData

  } catch (error) {
    console.error('❌ خطأ عام في النسخ الاحتياطي:', error)
    throw error
  }
}

// تشغيل السكريبت
backupData()
  .then(() => {
    console.log('\n✅ انتهت عملية النسخ الاحتياطي بنجاح')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ فشلت عملية النسخ الاحتياطي:', error)
    process.exit(1)
  })
