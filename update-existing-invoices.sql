-- Update existing invoices to have default values for new fields
-- This script should be run once to update existing data

-- First, add the new columns if they don't exist (they should already exist from the main schema)
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(12,2) DEFAULT 0.00;

-- Update existing invoices that don't have values for the new fields
UPDATE invoices 
SET 
    paid_amount = COALESCE(paid_amount, 0.00),
    remaining_amount = COALESCE(remaining_amount, amount)
WHERE paid_amount IS NULL OR remaining_amount IS NULL;

-- Update invoices based on their current status
-- If status is 'مدفوعة', set paid_amount = amount and remaining_amount = 0
UPDATE invoices 
SET 
    paid_amount = amount,
    remaining_amount = 0.00
WHERE status = 'مدفوعة' AND (paid_amount != amount OR remaining_amount != 0);

-- If status is 'معلقة' or 'متأخرة', ensure paid_amount = 0 and remaining_amount = amount
UPDATE invoices 
SET 
    paid_amount = 0.00,
    remaining_amount = amount
WHERE status IN ('معلقة', 'متأخرة') AND (paid_amount != 0 OR remaining_amount != amount);

-- Update the status based on payment amounts for consistency
UPDATE invoices 
SET status = CASE 
    WHEN paid_amount = 0 THEN 'معلقة'
    WHEN paid_amount >= amount THEN 'مدفوعة'
    ELSE 'مدفوعة جزئياً'
END
WHERE status NOT IN ('مسودة', 'ملغاة');

-- Ensure remaining_amount is calculated correctly
UPDATE invoices 
SET remaining_amount = amount - paid_amount
WHERE remaining_amount != (amount - paid_amount);

-- Add constraints to ensure data integrity
ALTER TABLE invoices 
ADD CONSTRAINT check_paid_amount_positive CHECK (paid_amount >= 0),
ADD CONSTRAINT check_remaining_amount_positive CHECK (remaining_amount >= 0),
ADD CONSTRAINT check_paid_not_exceed_amount CHECK (paid_amount <= amount);

-- Create index for better performance on payment queries
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(status, paid_amount, remaining_amount);

-- Show summary of updated invoices
SELECT 
    status,
    COUNT(*) as count,
    SUM(amount) as total_amount,
    SUM(paid_amount) as total_paid,
    SUM(remaining_amount) as total_remaining
FROM invoices 
GROUP BY status
ORDER BY status;
