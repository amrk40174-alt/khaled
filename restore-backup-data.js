// سكريپت استعادة البيانات المحفوظة إلى Supabase الجديد
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// بيانات الاتصال الجديدة
const NEW_SUPABASE_URL = 'https://txsyvygljhdhdbpnictp.supabase.co'
const NEW_SUPABASE_KEY = 'sb_publishable_mWxgFvlamjwkvCR7BAqP1Q_QIi9zx3d'

console.log('🔄 بدء عملية استعادة البيانات...')

// التحقق من بيانات الاتصال
if (NEW_SUPABASE_URL === 'YOUR_NEW_SUPABASE_URL' || NEW_SUPABASE_KEY === 'YOUR_NEW_SUPABASE_KEY') {
    console.error('❌ يرجى تحديث بيانات الاتصال في ملف .env أولاً')
    console.log('💡 تأكد من تحديث VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY')
    process.exit(1)
}

const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY)

async function restoreBackupData() {
    try {
        // قراءة ملف النسخة الاحتياطية
        const backupFile = './backup/latest-backup.json'
        if (!fs.existsSync(backupFile)) {
            throw new Error('❌ ملف النسخة الاحتياطية غير موجود في: ' + backupFile)
        }

        console.log('📁 تحميل النسخة الاحتياطية...')
        const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'))
        
        console.log('📊 البيانات المتاحة للاستعادة:')
        console.log(`   👥 التجار: ${backupData.data.merchants?.length || 0}`)
        console.log(`   📋 الفواتير: ${backupData.data.invoices?.length || 0}`)
        console.log(`   💰 المدفوعات: ${backupData.data.payments?.length || 0}`)

        let restoredMerchants = 0
        let restoredInvoices = 0
        let restoredPayments = 0

        // 1. استعادة التجار
        if (backupData.data.merchants && backupData.data.merchants.length > 0) {
            console.log('\n👥 استعادة بيانات التجار...')
            
            for (const merchant of backupData.data.merchants) {
                try {
                    // إزالة الحقول التي يتم إنشاؤها تلقائياً
                    const { id, created_at, updated_at, ...merchantData } = merchant
                    
                    const { data, error } = await supabase
                        .from('merchants')
                        .insert([merchantData])
                        .select()

                    if (error) {
                        console.error(`❌ خطأ في استعادة التاجر ${merchant.name}:`, error.message)
                    } else {
                        console.log(`✅ تم استعادة التاجر: ${merchant.name}`)
                        restoredMerchants++
                    }
                } catch (err) {
                    console.error(`❌ خطأ في معالجة التاجر ${merchant.name}:`, err.message)
                }
            }
        }

        // 2. استعادة الفواتير
        if (backupData.data.invoices && backupData.data.invoices.length > 0) {
            console.log('\n📋 استعادة بيانات الفواتير...')
            
            // الحصول على معرفات التجار الجديدة
            const { data: newMerchants } = await supabase
                .from('merchants')
                .select('id, name, email')

            const merchantMap = new Map()
            newMerchants?.forEach(m => {
                merchantMap.set(m.name, m.id)
                merchantMap.set(m.email, m.id)
            })

            for (const invoice of backupData.data.invoices) {
                try {
                    // البحث عن معرف التاجر الجديد
                    let newMerchantId = merchantMap.get(invoice.merchant_name)
                    
                    if (!newMerchantId) {
                        // البحث بالإيميل إذا لم نجد بالاسم
                        const merchantEmail = backupData.data.merchants?.find(m => m.id === invoice.merchant_id)?.email
                        if (merchantEmail) {
                            newMerchantId = merchantMap.get(merchantEmail)
                        }
                    }

                    if (!newMerchantId) {
                        console.error(`❌ لم يتم العثور على التاجر للفاتورة ${invoice.id}`)
                        continue
                    }

                    // إعداد بيانات الفاتورة
                    const { created_at, updated_at, ...invoiceData } = invoice
                    invoiceData.merchant_id = newMerchantId

                    const { data, error } = await supabase
                        .from('invoices')
                        .insert([invoiceData])
                        .select()

                    if (error) {
                        console.error(`❌ خطأ في استعادة الفاتورة ${invoice.id}:`, error.message)
                    } else {
                        console.log(`✅ تم استعادة الفاتورة: ${invoice.id}`)
                        restoredInvoices++
                    }
                } catch (err) {
                    console.error(`❌ خطأ في معالجة الفاتورة ${invoice.id}:`, err.message)
                }
            }
        }

        // 3. استعادة المدفوعات
        if (backupData.data.payments && backupData.data.payments.length > 0) {
            console.log('\n💰 استعادة بيانات المدفوعات...')
            
            // الحصول على معرفات الفواتير والتجار الجديدة
            const { data: newInvoices } = await supabase
                .from('invoices')
                .select('id, merchant_id')

            const invoiceMap = new Map()
            newInvoices?.forEach(inv => {
                invoiceMap.set(inv.id, inv.merchant_id)
            })

            for (const payment of backupData.data.payments) {
                try {
                    const newMerchantId = invoiceMap.get(payment.invoice_id)
                    
                    if (!newMerchantId) {
                        console.error(`❌ لم يتم العثور على الفاتورة ${payment.invoice_id} للدفعة`)
                        continue
                    }

                    // إعداد بيانات الدفعة
                    const { id, created_at, updated_at, ...paymentData } = payment
                    paymentData.merchant_id = newMerchantId

                    const { data, error } = await supabase
                        .from('payments')
                        .insert([paymentData])
                        .select()

                    if (error) {
                        console.error(`❌ خطأ في استعادة الدفعة:`, error.message)
                    } else {
                        console.log(`✅ تم استعادة دفعة: ${payment.amount} جنيه`)
                        restoredPayments++
                    }
                } catch (err) {
                    console.error(`❌ خطأ في معالجة الدفعة:`, err.message)
                }
            }
        }

        // 4. التحقق النهائي
        console.log('\n🔍 التحقق من البيانات المستعادة...')
        
        const { data: finalMerchants } = await supabase.from('merchants').select('*')
        const { data: finalInvoices } = await supabase.from('invoices').select('*')
        const { data: finalPayments } = await supabase.from('payments').select('*')
        
        console.log('\n🎉 تمت عملية الاستعادة بنجاح!')
        console.log('📊 ملخص النتائج:')
        console.log(`   👥 التجار المستعادة: ${restoredMerchants}/${backupData.data.merchants?.length || 0}`)
        console.log(`   📋 الفواتير المستعادة: ${restoredInvoices}/${backupData.data.invoices?.length || 0}`)
        console.log(`   💰 المدفوعات المستعادة: ${restoredPayments}/${backupData.data.payments?.length || 0}`)
        
        console.log('\n✅ البيانات الحالية في قاعدة البيانات:')
        console.log(`   👥 إجمالي التجار: ${finalMerchants?.length || 0}`)
        console.log(`   📋 إجمالي الفواتير: ${finalInvoices?.length || 0}`)
        console.log(`   💰 إجمالي المدفوعات: ${finalPayments?.length || 0}`)

        return {
            success: true,
            restored: {
                merchants: restoredMerchants,
                invoices: restoredInvoices,
                payments: restoredPayments
            },
            total: {
                merchants: finalMerchants?.length || 0,
                invoices: finalInvoices?.length || 0,
                payments: finalPayments?.length || 0
            }
        }

    } catch (error) {
        console.error('❌ خطأ في عملية الاستعادة:', error.message)
        throw error
    }
}

// تشغيل السكريپت
if (process.argv.includes('--run')) {
    restoreBackupData()
        .then((result) => {
            console.log('\n✅ انتهت عملية الاستعادة بنجاح')
            console.log('🚀 يمكنك الآن استخدام التطبيق مع البيانات المستعادة')
            process.exit(0)
        })
        .catch((error) => {
            console.error('\n❌ فشلت عملية الاستعادة:', error.message)
            process.exit(1)
        })
} else {
    console.log('💡 لتشغيل السكريپت، استخدم: bun restore-backup-data.js --run')
    console.log('⚠️  تأكد من تحديث بيانات الاتصال في ملف .env أولاً')
}
