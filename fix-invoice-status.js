// سكريپت إصلاح حالات الفواتير
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://txsyvygljhdhdbpnictp.supabase.co'
const supabaseKey = 'sb_publishable_mWxgFvlamjwkvCR7BAqP1Q_QIi9zx3d'
const supabase = createClient(supabaseUrl, supabaseKey)

async function fixInvoiceStatuses() {
    console.log('🔄 بدء إصلاح حالات الفواتير...')
    
    try {
        // جلب جميع الفواتير مع المدفوعات
        const { data: invoices, error } = await supabase
            .from('invoices')
            .select(`
                *,
                payments (
                    amount,
                    status
                )
            `)

        if (error) {
            console.error('❌ خطأ في جلب الفواتير:', error.message)
            return
        }

        console.log(`📋 تم جلب ${invoices?.length || 0} فاتورة`)

        let updatedCount = 0
        let errorCount = 0

        for (const invoice of invoices || []) {
            try {
                // حساب إجمالي المدفوع
                const totalPaid = invoice.payments
                    ?.filter(payment => payment.status === 'مؤكد')
                    ?.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0) || 0

                const remaining = parseFloat(invoice.amount) - totalPaid

                // تحديد الحالة الصحيحة
                let correctStatus = 'مستحقة'
                if (totalPaid >= parseFloat(invoice.amount)) {
                    correctStatus = 'مدفوعة'
                } else if (totalPaid > 0) {
                    correctStatus = 'مدفوعة جزئياً'
                } else {
                    // التحقق من تاريخ الاستحقاق
                    const dueDate = new Date(invoice.due_date)
                    const today = new Date()
                    if (dueDate < today) {
                        correctStatus = 'متأخرة'
                    }
                }

                // تحديث الفاتورة إذا كانت الحالة مختلفة
                if (invoice.status !== correctStatus || 
                    parseFloat(invoice.paid_amount || 0) !== totalPaid ||
                    parseFloat(invoice.remaining_amount || 0) !== remaining) {
                    
                    const { error: updateError } = await supabase
                        .from('invoices')
                        .update({
                            status: correctStatus,
                            paid_amount: totalPaid,
                            remaining_amount: remaining,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', invoice.id)

                    if (updateError) {
                        console.error(`❌ خطأ في تحديث الفاتورة ${invoice.id}:`, updateError.message)
                        errorCount++
                    } else {
                        console.log(`✅ تم تحديث الفاتورة ${invoice.id}:`)
                        console.log(`   📋 الحالة: ${invoice.status} → ${correctStatus}`)
                        console.log(`   💰 المدفوع: ${invoice.paid_amount || 0} → ${totalPaid}`)
                        console.log(`   📉 المتبقي: ${invoice.remaining_amount || 0} → ${remaining}`)
                        updatedCount++
                    }
                } else {
                    console.log(`✓ الفاتورة ${invoice.id} محدثة بالفعل`)
                }

            } catch (err) {
                console.error(`❌ خطأ في معالجة الفاتورة ${invoice.id}:`, err.message)
                errorCount++
            }
        }

        console.log('\n🎉 انتهى إصلاح حالات الفواتير!')
        console.log(`📊 النتائج:`)
        console.log(`   ✅ تم تحديث: ${updatedCount} فاتورة`)
        console.log(`   ❌ أخطاء: ${errorCount} فاتورة`)
        console.log(`   📋 إجمالي: ${invoices?.length || 0} فاتورة`)

        // إحصائيات نهائية
        console.log('\n📈 إحصائيات الحالات النهائية:')
        const { data: finalStats } = await supabase
            .from('invoices')
            .select('status')

        const statusCounts = {}
        finalStats?.forEach(invoice => {
            statusCounts[invoice.status] = (statusCounts[invoice.status] || 0) + 1
        })

        Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`   📋 ${status}: ${count} فاتورة`)
        })

    } catch (error) {
        console.error('❌ خطأ عام:', error.message)
    }
}

// تشغيل السكريپت
fixInvoiceStatuses()
    .then(() => {
        console.log('\n✅ انتهى الإصلاح بنجاح')
        process.exit(0)
    })
    .catch((error) => {
        console.error('\n❌ فشل الإصلاح:', error.message)
        process.exit(1)
    })
