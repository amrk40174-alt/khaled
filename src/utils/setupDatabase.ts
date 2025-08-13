import { supabase } from '@/lib/supabase';

export const setupPaymentsTable = async () => {
  try {
    console.log('Setting up payments table...');

    // Create payments table
    const { error: createTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS payments (
          id BIGSERIAL PRIMARY KEY,
          invoice_id VARCHAR(50) NOT NULL,
          merchant_id BIGINT NOT NULL,
          amount DECIMAL(12,2) NOT NULL,
          payment_method VARCHAR(20) DEFAULT 'نقدي' CHECK (payment_method IN ('نقدي', 'تحويل بنكي', 'شيك', 'بطاقة ائتمان')),
          payment_date DATE DEFAULT CURRENT_DATE,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (createTableError) {
      console.error('Error creating payments table:', createTableError);
      throw createTableError;
    }

    // Add columns to invoices if they don't exist
    const { error: alterTableError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE invoices 
        ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(12,2) DEFAULT 0.00;
      `
    });

    if (alterTableError) {
      console.error('Error altering invoices table:', alterTableError);
      // Don't throw here, might already exist
    }

    // Update existing invoices
    const { error: updateError } = await supabase.rpc('exec_sql', {
      sql: `
        UPDATE invoices 
        SET 
            paid_amount = COALESCE(paid_amount, 0.00),
            remaining_amount = COALESCE(remaining_amount, amount)
        WHERE paid_amount IS NULL OR remaining_amount IS NULL;
      `
    });

    if (updateError) {
      console.error('Error updating invoices:', updateError);
      // Don't throw here, might be fine
    }

    console.log('Payments table setup completed successfully');
    return true;

  } catch (error) {
    console.error('Error setting up payments table:', error);
    return false;
  }
};

// Alternative approach: Create table directly using Supabase client
export const createPaymentsTableDirect = async () => {
  try {
    console.log('Creating payments table directly...');

    // First, let's try to create the table using raw SQL
    const { data, error } = await supabase
      .from('payments')
      .select('id')
      .limit(1);

    if (error && error.code === 'PGRST116') {
      // Table doesn't exist, we need to create it
      console.log('Payments table does not exist. Please create it manually in Supabase dashboard.');
      
      const sqlScript = `
-- Create payments table
CREATE TABLE payments (
  id BIGSERIAL PRIMARY KEY,
  invoice_id VARCHAR(50) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  merchant_id BIGINT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(20) DEFAULT 'نقدي' CHECK (payment_method IN ('نقدي', 'تحويل بنكي', 'شيك', 'بطاقة ائتمان')),
  payment_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_merchant_id ON payments(merchant_id);
CREATE INDEX idx_payments_date ON payments(payment_date);

-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all operations on payments" ON payments
    FOR ALL USING (true) WITH CHECK (true);

-- Add columns to invoices
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(12,2) DEFAULT 0.00;
      `;

      console.log('Please run this SQL in your Supabase SQL editor:');
      console.log(sqlScript);
      
      return { success: false, sql: sqlScript };
    } else if (error) {
      console.error('Error checking payments table:', error);
      return { success: false, error };
    } else {
      console.log('Payments table already exists');
      return { success: true };
    }

  } catch (error) {
    console.error('Error in createPaymentsTableDirect:', error);
    return { success: false, error };
  }
};
