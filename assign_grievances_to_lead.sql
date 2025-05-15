-- Function to automatically assign grievances to department Lead
CREATE OR REPLACE FUNCTION auto_assign_grievances_to_lead()
RETURNS TRIGGER AS $$
BEGIN
  -- Find the Lead employee for the department
  UPDATE grievances 
  SET assigned_employee_id = (
    SELECT p.id 
    FROM profiles p 
    WHERE p.category_id = NEW.category_id 
      AND p.designation = 'Lead' 
      AND p.role = 'employee'
    LIMIT 1
  )
  WHERE id = NEW.id 
    AND assigned_employee_id IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-assign new grievances
DROP TRIGGER IF EXISTS grievance_auto_assign_trigger ON grievances;
CREATE TRIGGER grievance_auto_assign_trigger
AFTER INSERT ON grievances
FOR EACH ROW
EXECUTE FUNCTION auto_assign_grievances_to_lead(); 