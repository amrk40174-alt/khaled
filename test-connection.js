// اختبار الاتصال بـ Supabase الجديد
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://txsyvygljhdhdbpnictp.supabase.co'
const supabaseKey = 'sb_publishable_mWxgFvlamjwkvCR7BAqP1Q_QIi9zx3d'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
    console.log('🔄 اختبار الاتصال بـ Supabase الجديد...')
    console.log(`📡 URL: ${supabaseUrl}`)
    
    try {
        // اختبار الاتصال الأساسي
        const { data, error } = await supabase
            .from('merchants')
            .select('count', { count: 'exact', head: true })

        if (error) {
            console.error('❌ خطأ في الاتصال:', error.message)
            
            if (error.message.includes('relation "merchants" does not exist')) {
                console.log('💡 يبدو أن الجداول لم يتم إنشاؤها بعد')
                console.log('📋 يرجى تنفيذ ملف complete-database-schema.sql في Supabase SQL Editor أولاً')
            }
            
            return false
        } else {
            console.log('✅ تم الاتصال بنجاح!')
            console.log(`📊 عدد التجار الحالي: ${data || 0}`)
            
            // اختبار الجداول الأخرى
            const tables = ['invoices', 'payments', 'system_settings']
            
            for (const table of tables) {
                try {
                    const { data: tableData, error: tableError } = await supabase
                        .from(table)
                        .select('count', { count: 'exact', head: true })
                    
                    if (tableError) {
                        console.log(`⚠️  جدول ${table}: ${tableError.message}`)
                    } else {
                        console.log(`✅ جدول ${table}: ${tableData || 0} سجل`)
                    }
                } catch (err) {
                    console.log(`❌ خطأ في جدول ${table}: ${err.message}`)
                }
            }
            
            return true
        }
    } catch (error) {
        console.error('❌ خطأ عام في الاتصال:', error.message)
        return false
    }
}

// تشغيل الاختبار
testConnection()
    .then((success) => {
        if (success) {
            console.log('\n🎉 الاتصال يعمل بشكل صحيح!')
            console.log('🚀 يمكنك الآن استعادة البيانات المحفوظة')
        } else {
            console.log('\n❌ فشل الاتصال')
            console.log('💡 تأكد من تنفيذ السكريپت في Supabase أولاً')
        }
        process.exit(success ? 0 : 1)
    })
    .catch((error) => {
        console.error('\n❌ خطأ في الاختبار:', error.message)
        process.exit(1)
    })
