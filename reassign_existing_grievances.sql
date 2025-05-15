-- Assign all unassigned grievances to the department Lead
UPDATE grievances g
SET assigned_employee_id = (
  SELECT p.id 
  FROM profiles p 
  WHERE p.category_id = g.category_id 
    AND p.designation = 'Lead' 
    AND p.role = 'employee'
  LIMIT 1
)
WHERE g.assigned_employee_id IS NULL;

-- Check if any grievances are still unassigned (in case of missing Leads)
SELECT id, title, category_id 
FROM grievances 
WHERE assigned_employee_id IS NULL; 