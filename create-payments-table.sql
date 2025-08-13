-- Create payments table
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

-- Add foreign key constraints (if tables exist)
DO $$ 
BEGIN
    -- Add foreign key to invoices if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
        ALTER TABLE payments 
        ADD CONSTRAINT fk_payments_invoice 
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
    END IF;
    
    -- Add foreign key to merchants if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchants') THEN
        ALTER TABLE payments 
        ADD CONSTRAINT fk_payments_merchant 
        FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_merchant_id ON payments(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_payments_updated_at 
    BEFORE UPDATE ON payments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Allow all operations on payments" ON payments
    FOR ALL USING (true) WITH CHECK (true);

-- Add columns to invoices table if they don't exist
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(12,2) DEFAULT 0.00;

-- Update existing invoices
UPDATE invoices 
SET 
    paid_amount = COALESCE(paid_amount, 0.00),
    remaining_amount = COALESCE(remaining_amount, amount)
WHERE paid_amount IS NULL OR remaining_amount IS NULL;

-- Create function to update invoice amounts when payment is added/updated/deleted
CREATE OR REPLACE FUNCTION update_invoice_amounts()
RETURNS TRIGGER AS $$
BEGIN
    -- Update invoice amounts for the affected invoice
    IF TG_OP = 'DELETE' THEN
        UPDATE invoices 
        SET 
            paid_amount = (
                SELECT COALESCE(SUM(amount), 0) 
                FROM payments 
                WHERE invoice_id = OLD.invoice_id
            )
        WHERE id = OLD.invoice_id;
        
        -- Update remaining amount and status
        UPDATE invoices 
        SET 
            remaining_amount = amount - paid_amount,
            status = CASE 
                WHEN paid_amount = 0 THEN 'معلقة'
                WHEN paid_amount >= amount THEN 'مدفوعة'
                ELSE 'مدفوعة جزئياً'
            END
        WHERE id = OLD.invoice_id;
        
        RETURN OLD;
    ELSE
        UPDATE invoices 
        SET 
            paid_amount = (
                SELECT COALESCE(SUM(amount), 0) 
                FROM payments 
                WHERE invoice_id = NEW.invoice_id
            )
        WHERE id = NEW.invoice_id;
        
        -- Update remaining amount and status
        UPDATE invoices 
        SET 
            remaining_amount = amount - paid_amount,
            status = CASE 
                WHEN paid_amount = 0 THEN 'معلقة'
                WHEN paid_amount >= amount THEN 'مدفوعة'
                ELSE 'مدفوعة جزئياً'
            END
        WHERE id = NEW.invoice_id;
        
        RETURN NEW;
    END IF;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update invoice amounts
DROP TRIGGER IF EXISTS update_invoice_amounts_on_insert ON payments;
DROP TRIGGER IF EXISTS update_invoice_amounts_on_update ON payments;
DROP TRIGGER IF EXISTS update_invoice_amounts_on_delete ON payments;

CREATE TRIGGER update_invoice_amounts_on_insert
    AFTER INSERT ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_amounts();

CREATE TRIGGER update_invoice_amounts_on_update
    AFTER UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_amounts();

CREATE TRIGGER update_invoice_amounts_on_delete
    AFTER DELETE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_amounts();

-- Show table structure
\d payments;
