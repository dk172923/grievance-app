-- Check for categories without a Lead employee assigned to them
SELECT c.id AS category_id, c.name AS category_name, 
       (SELECT COUNT(*) FROM grievances g WHERE g.category_id = c.id) AS grievance_count,
       (SELECT COUNT(*) FROM grievances g WHERE g.category_id = c.id AND g.assigned_employee_id IS NULL) AS unassigned_count,
       EXISTS (
         SELECT 1 FROM profiles p 
         WHERE p.category_id = c.id 
           AND p.designation = 'Lead' 
           AND p.role = 'employee'
       ) AS has_lead
FROM categories c
ORDER BY has_lead, grievance_count DESC;

-- Show all employees with designation 'Lead'
SELECT id, name, email, category_id, designation 
FROM profiles 
WHERE designation = 'Lead' AND role = 'employee'; 