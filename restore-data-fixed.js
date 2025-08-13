// سكريپت محسن لاستعادة البيانات مع معالجة الأخطاء
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseUrl = 'https://txsyvygljhdhdbpnictp.supabase.co'
const supabaseKey = 'sb_publishable_mWxgFvlamjwkvCR7BAqP1Q_QIi9zx3d'
const supabase = createClient(supabaseUrl, supabaseKey)

async function restoreDataFixed() {
    console.log('🔄 بدء عملية الاستعادة المحسنة...')
    
    try {
        // قراءة النسخة الاحتياطية
        const backupData = JSON.parse(fs.readFileSync('./backup/latest-backup.json', 'utf8'))
        
        console.log('📊 البيانات المتاحة:')
        console.log(`   👥 التجار: ${backupData.data.merchants?.length || 0}`)
        console.log(`   📋 الفواتير: ${backupData.data.invoices?.length || 0}`)
        console.log(`   💰 المدفوعات: ${backupData.data.payments?.length || 0}`)

        let restoredInvoices = 0
        let restoredPayments = 0

        // الحصول على التجار الجدد
        const { data: newMerchants } = await supabase
            .from('merchants')
            .select('id, name, email')

        const merchantMap = new Map()
        newMerchants?.forEach(m => {
            merchantMap.set(m.name.trim(), m.id)
            merchantMap.set(m.email.trim(), m.id)
        })

        console.log(`\n📋 استعادة الفواتير (${backupData.data.invoices?.length || 0})...`)

        // استعادة الفواتير
        for (const invoice of backupData.data.invoices || []) {
            try {
                // البحث عن معرف التاجر الجديد
                let newMerchantId = merchantMap.get(invoice.merchant_name?.trim())
                
                if (!newMerchantId) {
                    console.error(`❌ لم يتم العثور على التاجر: ${invoice.merchant_name}`)
                    continue
                }

                // تنظيف بيانات الفاتورة
                const cleanInvoice = {
                    id: invoice.id,
                    merchant_id: newMerchantId,
                    merchant_name: invoice.merchant_name,
                    amount: parseFloat(invoice.amount) || 0,
                    paid_amount: parseFloat(invoice.paid_amount) || 0,
                    remaining_amount: parseFloat(invoice.remaining_amount) || parseFloat(invoice.amount) || 0,
                    status: invoice.status || 'مستحقة',
                    due_date: invoice.due_date,
                    description: invoice.items ? JSON.stringify(invoice.items) : (invoice.description || ''),
                    payment_method: invoice.payment_method || 'نقدي'
                }

                const { data, error } = await supabase
                    .from('invoices')
                    .insert([cleanInvoice])
                    .select()

                if (error) {
                    console.error(`❌ خطأ في الفاتورة ${invoice.id}:`, error.message)
                } else {
                    console.log(`✅ تم استعادة الفاتورة: ${invoice.id} - ${invoice.amount} جنيه`)
                    restoredInvoices++
                }
            } catch (err) {
                console.error(`❌ خطأ في معالجة الفاتورة ${invoice.id}:`, err.message)
            }
        }

        console.log(`\n💰 استعادة المدفوعات (${backupData.data.payments?.length || 0})...`)

        // الحصول على الفواتير الجديدة
        const { data: newInvoices } = await supabase
            .from('invoices')
            .select('id, merchant_id')

        const invoiceMap = new Map()
        newInvoices?.forEach(inv => {
            invoiceMap.set(inv.id, inv.merchant_id)
        })

        // استعادة المدفوعات
        for (const payment of backupData.data.payments || []) {
            try {
                const newMerchantId = invoiceMap.get(payment.invoice_id)
                
                if (!newMerchantId) {
                    console.error(`❌ لم يتم العثور على الفاتورة: ${payment.invoice_id}`)
                    continue
                }

                // تنظيف بيانات الدفعة
                const cleanPayment = {
                    invoice_id: payment.invoice_id,
                    merchant_id: newMerchantId,
                    amount: parseFloat(payment.amount) || 0,
                    payment_method: payment.payment_method || 'نقدي',
                    payment_date: payment.payment_date,
                    reference_number: payment.reference_number || null,
                    notes: payment.notes || null,
                    status: payment.status || 'مؤكد',
                    created_by: payment.created_by || 'النظام'
                }

                const { data, error } = await supabase
                    .from('payments')
                    .insert([cleanPayment])
                    .select()

                if (error) {
                    console.error(`❌ خطأ في الدفعة:`, error.message)
                } else {
                    console.log(`✅ تم استعادة دفعة: ${payment.amount} جنيه للفاتورة ${payment.invoice_id}`)
                    restoredPayments++
                }
            } catch (err) {
                console.error(`❌ خطأ في معالجة الدفعة:`, err.message)
            }
        }

        // التحقق النهائي
        console.log('\n🔍 التحقق من البيانات النهائية...')
        
        const { data: finalMerchants } = await supabase.from('merchants').select('*')
        const { data: finalInvoices } = await supabase.from('invoices').select('*')
        const { data: finalPayments } = await supabase.from('payments').select('*')
        
        console.log('\n🎉 تمت عملية الاستعادة!')
        console.log('📊 النتائج النهائية:')
        console.log(`   👥 التجار: ${finalMerchants?.length || 0}`)
        console.log(`   📋 الفواتير: ${finalInvoices?.length || 0} (استعيد: ${restoredInvoices})`)
        console.log(`   💰 المدفوعات: ${finalPayments?.length || 0} (استعيد: ${restoredPayments})`)

        // حساب الإحصائيات
        const totalAmount = finalInvoices?.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0) || 0
        const totalPaid = finalPayments?.reduce((sum, pay) => sum + parseFloat(pay.amount || 0), 0) || 0
        
        console.log('\n💰 الإحصائيات المالية:')
        console.log(`   📈 إجمالي الفواتير: ${totalAmount.toFixed(2)} جنيه`)
        console.log(`   💳 إجمالي المدفوع: ${totalPaid.toFixed(2)} جنيه`)
        console.log(`   📉 المتبقي: ${(totalAmount - totalPaid).toFixed(2)} جنيه`)

        return {
            success: true,
            merchants: finalMerchants?.length || 0,
            invoices: finalInvoices?.length || 0,
            payments: finalPayments?.length || 0,
            totalAmount,
            totalPaid
        }

    } catch (error) {
        console.error('❌ خطأ عام:', error.message)
        throw error
    }
}

// تشغيل السكريپت
restoreDataFixed()
    .then((result) => {
        console.log('\n✅ تمت الاستعادة بنجاح!')
        console.log('🚀 يمكنك الآن استخدام التطبيق مع جميع البيانات!')
        process.exit(0)
    })
    .catch((error) => {
        console.error('\n❌ فشلت الاستعادة:', error.message)
        process.exit(1)
    })
