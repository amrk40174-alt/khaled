// Direct SQL execution using Supabase REST API
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const executeSQL = async (sql: string) => {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ sql }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    console.error('Error executing SQL:', error);
    return { success: false, error: error.message };
  }
};

export const createPaymentsTableDirect = async () => {
  const sql = `
    -- Create payments table
    CREATE TABLE IF NOT EXISTS payments (
      id BIGSERIAL PRIMARY KEY,
      invoice_id VARCHAR(50) NOT NULL,
      merchant_id BIGINT NOT NULL,
      amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
      payment_method VARCHAR(20) DEFAULT 'نقدي' CHECK (payment_method IN ('نقدي', 'تحويل بنكي', 'شيك', 'بطاقة ائتمان')),
      payment_date DATE DEFAULT CURRENT_DATE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Add foreign key constraints
    DO $$ 
    BEGIN
        -- Add foreign key to invoices if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_payments_invoice'
        ) THEN
            ALTER TABLE payments 
            ADD CONSTRAINT fk_payments_invoice 
            FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
        END IF;
        
        -- Add foreign key to merchants if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_payments_merchant'
        ) THEN
            ALTER TABLE payments 
            ADD CONSTRAINT fk_payments_merchant 
            FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE;
        END IF;
    END $$;

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_payments_merchant_id ON payments(merchant_id);
    CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

    -- Add columns to invoices table
    ALTER TABLE invoices 
    ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(12,2) DEFAULT 0.00;

    -- Update existing invoices
    UPDATE invoices 
    SET 
        paid_amount = COALESCE(paid_amount, 0.00),
        remaining_amount = COALESCE(remaining_amount, amount)
    WHERE paid_amount IS NULL OR remaining_amount IS NULL;

    -- Enable RLS
    ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

    -- Create policy
    DROP POLICY IF EXISTS "Allow all operations on payments" ON payments;
    CREATE POLICY "Allow all operations on payments" ON payments
        FOR ALL USING (true) WITH CHECK (true);

    -- Create function to update invoice amounts
    CREATE OR REPLACE FUNCTION update_invoice_amounts()
    RETURNS TRIGGER AS $$
    BEGIN
        IF TG_OP = 'DELETE' THEN
            UPDATE invoices 
            SET 
                paid_amount = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = OLD.invoice_id),
                remaining_amount = amount - (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = OLD.invoice_id)
            WHERE id = OLD.invoice_id;
            
            UPDATE invoices 
            SET status = CASE 
                WHEN paid_amount = 0 THEN 'معلقة'
                WHEN paid_amount >= amount THEN 'مدفوعة'
                ELSE 'مدفوعة جزئياً'
            END
            WHERE id = OLD.invoice_id AND status NOT IN ('مسودة', 'ملغاة');
            
            RETURN OLD;
        ELSE
            UPDATE invoices 
            SET 
                paid_amount = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = NEW.invoice_id),
                remaining_amount = amount - (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = NEW.invoice_id)
            WHERE id = NEW.invoice_id;
            
            UPDATE invoices 
            SET status = CASE 
                WHEN paid_amount = 0 THEN 'معلقة'
                WHEN paid_amount >= amount THEN 'مدفوعة'
                ELSE 'مدفوعة جزئياً'
            END
            WHERE id = NEW.invoice_id AND status NOT IN ('مسودة', 'ملغاة');
            
            RETURN NEW;
        END IF;
    END;
    $$ language 'plpgsql';

    -- Create triggers
    DROP TRIGGER IF EXISTS update_invoice_amounts_on_insert ON payments;
    DROP TRIGGER IF EXISTS update_invoice_amounts_on_update ON payments;
    DROP TRIGGER IF EXISTS update_invoice_amounts_on_delete ON payments;

    CREATE TRIGGER update_invoice_amounts_on_insert
        AFTER INSERT ON payments FOR EACH ROW EXECUTE FUNCTION update_invoice_amounts();

    CREATE TRIGGER update_invoice_amounts_on_update
        AFTER UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_invoice_amounts();

    CREATE TRIGGER update_invoice_amounts_on_delete
        AFTER DELETE ON payments FOR EACH ROW EXECUTE FUNCTION update_invoice_amounts();
  `;

  return await executeSQL(sql);
};

// Simple approach: Create table using basic SQL
export const createPaymentsTableSimple = async () => {
  try {
    // First, try to create the table using a simple approach
    const response = await fetch(`${SUPABASE_URL}/rest/v1/payments`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (response.status === 404) {
      // Table doesn't exist, return SQL for manual creation
      const sql = `-- إنشاء جدول المدفوعات
CREATE TABLE payments (
  id BIGSERIAL PRIMARY KEY,
  invoice_id VARCHAR(50) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  merchant_id BIGINT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(20) DEFAULT 'نقدي' CHECK (payment_method IN ('نقدي', 'تحويل بنكي', 'شيك', 'بطاقة ائتمان')),
  payment_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إضافة أعمدة للفواتير
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(12,2) DEFAULT 0.00;

-- تحديث الفواتير الموجودة
UPDATE invoices SET paid_amount = 0.00, remaining_amount = amount WHERE paid_amount IS NULL;

-- تفعيل الأمان
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on payments" ON payments FOR ALL USING (true) WITH CHECK (true);`;

      return { success: false, needsManualSetup: true, sql };
    } else if (response.ok) {
      // Table exists
      return { success: true, exists: true };
    } else {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error: any) {
    console.error('Error checking payments table:', error);
    return { success: false, error: error.message };
  }
};
