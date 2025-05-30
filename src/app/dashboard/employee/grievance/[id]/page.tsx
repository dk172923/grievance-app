'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../../lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import ProtectedRoute from '../../../../../components/ProtectedRoute';
import Tree, { TreeNodeDatum } from 'react-d3-tree';
import Header from '../../../../../components/Header';
import Link from 'next/link';

interface TreeNode {
  name: string;
  designation?: string;
  children?: TreeNode[];
}

interface Employee {
  id: string;
  name: string;
  designation: string;
}

interface GrievanceAction {
  id: number;
  action_text: string;
  created_at: string;
  employee: { name: string; designation: string };
}

interface Document {
  name: string;
  url: string;
}

interface Grievance {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  user_id: string;
  assigned_employee_id?: string;
  categories: { id: number; name: string };
  profiles?: { name: string; designation: string; location: string; email: string };
  submitter?: { id: string; email: string };
  assigned_by?: { name: string; designation: string };
  hierarchy?: TreeNode;
  actions?: GrievanceAction[];
  documents?: Document[];
  grievance_resolved_file?: string;
}

interface SuggestedAction {
  action: string;
  count: number;
  recentDate: string;
}

export default function GrievanceDetail() {
  const router = useRouter();
  const { id } = useParams();
  const [grievance, setGrievance] = useState<Grievance | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [profile, setProfile] = useState<{ id: string; category_id: number; designation: string; name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInput, setActionInput] = useState('');
  const [statusInput, setStatusInput] = useState('Pending');
  const [suggestedActions, setSuggestedActions] = useState<SuggestedAction[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [resolvedFile, setResolvedFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchGrievance = async () => {
      try {
        setLoading(true);
        const sessionResponse = await supabase.auth.getSession();
        const session = sessionResponse.data.session;
        if (!session) throw new Error('User not authenticated.');

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, category_id, designation, name, email')
          .eq('id', session.user.id)
          .single();

        if (profileError || !profileData) throw new Error('Profile not found.');
        setProfile(profileData);

        const { data: grievanceData, error: grievanceError } = await supabase
          .from('grievances')
          .select(`
            id,
            title,
            description,
            status,
            priority,
            created_at,
            user_id,
            assigned_employee_id,
            category_id,
            grievance_resolved_file,
            profiles!grievances_assigned_employee_id_fkey (name, designation, location, email),
            submitter:profiles!grievances_user_id_fkey1 (id, email),
            grievance_delegations!grievance_id (
              from_employee_id,
              to_employee_id,
              from_profile:from_employee_id (name, designation),
              to_profile:to_employee_id (name, designation)
            ),
            grievance_actions!grievance_id (
              id,
              action_text,
              created_at,
              employee:profiles!grievance_actions_employee_id_fkey (name, designation)
            )
          `)
          .eq('id', id)
          .single();

        if (grievanceError) throw grievanceError;

        const { data: categoryData, error: categoryError } = await supabase
          .from('categories')
          .select('id, name')
          .eq('id', grievanceData.category_id)
          .single();

        if (categoryError) throw categoryError;

        grievanceData.categories = categoryData;

        const { data: files, error: storageError } = await supabase.storage
          .from('grievance-documents')
          .list(`grievance-${id}`);

        if (storageError) throw storageError;

        const documents = files?.map(file => ({
          name: file.name,
          url: supabase.storage.from('grievance-documents').getPublicUrl(`grievance-${id}/${file.name}`).data.publicUrl,
        })) || [];

        let hierarchy: TreeNode = { name: 'Unassigned', designation: '', children: [] };
        const delegations = Array.isArray(grievanceData.grievance_delegations) ? grievanceData.grievance_delegations : [];

        if (delegations.length > 0) {
          const employeeMap = new Map<string, TreeNode>();
          delegations.forEach((d: any) => {
            if (d.from_employee_id && d.from_profile) {
              employeeMap.set(d.from_employee_id, {
                name: d.from_profile.name,
                designation: d.from_profile.designation,
                children: [],
              });
            }
            if (d.to_employee_id && d.to_profile) {
              employeeMap.set(d.to_employee_id, {
                name: d.to_profile.name,
                designation: d.to_profile.designation,
                children: [],
              });
            }
          });

          delegations.forEach((d: any) => {
            const fromNode = d.from_employee_id ? employeeMap.get(d.from_employee_id) : null;
            const toNode = d.to_employee_id ? employeeMap.get(d.to_employee_id) : null;
            if (fromNode && toNode) {
              fromNode.children = fromNode.children || [];
              if (!fromNode.children.some(child => child.name === toNode.name)) {
                fromNode.children.push(toNode);
              }
            }
          });

          const firstDelegation = delegations[0];
          if (firstDelegation.from_employee_id) {
            hierarchy = employeeMap.get(firstDelegation.from_employee_id) || hierarchy;
          }
        } else if (grievanceData.profiles) {
          hierarchy = { name: grievanceData.profiles.name, designation: grievanceData.profiles.designation, children: [] };
        }

        const actions = Array.isArray(grievanceData.grievance_actions)
          ? grievanceData.grievance_actions
              .map((a: any) => ({
                id: a.id,
                action_text: a.action_text,
                created_at: a.created_at,
                employee: a.employee,
              }))
              .sort((a: GrievanceAction, b: GrievanceAction) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )
          : [];

        setGrievance({
          ...grievanceData,
          categories: Array.isArray(grievanceData.categories) ? grievanceData.categories[0] : grievanceData.categories,
          profiles: Array.isArray(grievanceData.profiles) ? grievanceData.profiles[0] : grievanceData.profiles,
          submitter: Array.isArray(grievanceData.submitter) ? grievanceData.submitter[0] : grievanceData.submitter,
          assigned_by: delegations[0]?.from_profile
            ? { name: delegations[0].from_profile.name, designation: delegations[0].from_profile.designation }
            : undefined,
          hierarchy,
          actions,
          documents,
        });

        const { data: employeesData, error: employeesError } = await supabase
          .from('profiles')
          .select('id, name, designation')
          .eq('category_id', profileData.category_id)
          .eq('role', 'employee')
          .neq('id', session.user.id)
          .in('designation', profileData.designation === 'Lead' ? ['Senior', 'Junior'] : ['Junior']);

        if (employeesError) throw employeesError;
        setEmployees(employeesData || []);

        fetchSuggestedActions(grievanceData);
      } catch (error: any) {
        console.error('Error fetching grievance:', error);
        setError(error.message || 'Failed to load grievance.');
      } finally {
        setLoading(false);
      }
    };

    fetchGrievance();
  }, [id]);

  const fetchSuggestedActions = async (grievance: any) => {
    setRecLoading(true);
    try {
      const { data: cachedActions, error: cacheError } = await supabase
        .from('grievance_suggested_actions')
        .select('suggested_actions')
        .eq('grievance_id', id)
        .single();

      if (cacheError && cacheError.code !== 'PGRST116') throw cacheError;

      if (cachedActions) {
        const filteredCachedActions = cachedActions.suggested_actions.filter(
          (a: SuggestedAction) => !a.action.toLowerCase().includes('grievance reopened by user')
        );
        setSuggestedActions(filteredCachedActions);
        setRecLoading(false);
        return;
      }

      const categoryId = grievance.categories?.id;
      if (!categoryId) {
        throw new Error('Grievance category ID is missing.');
      }

      const { data, error } = await supabase
        .from('grievances')
        .select(`
          id,
          description,
          status,
          priority,
          created_at,
          category_id,
          grievance_actions!grievance_id (action_text, created_at)
        `)
        .neq('id', id)
        .eq('category_id', categoryId)
        .in('status', ['In Progress', 'Resolved'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (!data || data.length === 0) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const { data: recentActions, error: recentError } = await supabase
          .from('grievance_actions')
          .select('action_text, created_at')
          .in('grievance_id', (
            await supabase
              .from('grievances')
              .select('id')
              .eq('category_id', categoryId)
              .gte('created_at', sixMonthsAgo.toISOString())
          ).data?.map(g => g.id) || [])
          .gte('created_at', sixMonthsAgo.toISOString())
          .not('action_text', 'ilike', '%Grievance reopened by user%')
          .order('created_at', { ascending: false })
          .limit(5);

        if (recentError) throw recentError;

        const actionFreq: Record<string, { count: number; recentDate: string }> = {};
        (recentActions || []).forEach(a => {
          const text = a.action_text.trim();
          if (!actionFreq[text]) {
            actionFreq[text] = { count: 0, recentDate: a.created_at };
          }
          actionFreq[text].count += 1;
          if (new Date(a.created_at) > new Date(actionFreq[text].recentDate)) {
            actionFreq[text].recentDate = a.created_at;
          }
        });

        const uniqueActions = Object.entries(actionFreq)
          .map(([text, { count, recentDate }]) => ({
            action: text,
            count,
            recentDate,
          }))
          .filter(a => a.action.length > 10)
          .sort((a, b) => b.count - a.count || new Date(b.recentDate).getTime() - new Date(a.recentDate).getTime())
          .slice(0, 5);

        if (uniqueActions.length > 0) {
          await supabase
            .from('grievance_suggested_actions')
            .insert({
              grievance_id: id,
              suggested_actions: uniqueActions,
              created_at: new Date().toISOString(),
            });
        }

        setSuggestedActions(uniqueActions);
        setRecLoading(false);
        return;
      }

      const currentText = (grievance.description || '').toLowerCase();
      const stopwords = ['the', 'a', 'an', 'at', 'in', 'on', 'for', 'to', 'of', 'and', 'is', 'are', 'has', 'have', 'like', 'most'];
      const scored = data.map((g: any) => {
        const gText = (g.description || '').toLowerCase();
        const textA = currentText.split(/\W+/).filter(w => w.length > 2 && !stopwords.includes(w));
        const textB = gText.split(/\W+/).filter(w => w.length > 2 && !stopwords.includes(w));
        const allWords = [...new Set([...textA, ...textB])];
        const vecA = allWords.map(w => textA.includes(w) ? 1 : 0);
        const vecB = allWords.map(w => textB.includes(w) ? 1 : 0);
        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
        const cosineSimilarity = (normA && normB) ? dotProduct / (normA * normB) : 0;

        return {
          ...g,
          similarityScore: cosineSimilarity,
          actions: (g.grievance_actions || [])
            .filter((a: any) => !a.action_text.toLowerCase().includes('grievance reopened by user'))
            .map((a: any) => ({
              action_text: a.action_text,
              created_at: a.created_at,
            })),
        };
      });

      const filtered = scored
        .filter(g => {
          const gText = (g.description || '').toLowerCase();
          const textA = currentText.split(/\W+/).filter(w => w.length > 2 && !stopwords.includes(w));
          const textB = gText.split(/\W+/).filter(w => w.length > 2 && !stopwords.includes(w));
          const commonWords = textA.filter(w => textB.includes(w)).length;
          return g.similarityScore > 0.3 && g.actions && g.actions.length > 0 && commonWords >= 1;
        })
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, 5);

      const actionFreq: Record<string, { count: number; recentDate: string }> = {};
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      if (filtered.length > 0) {
        filtered.forEach(g => {
          g.actions.forEach((a: any) => {
            const text = a.action_text.trim();
            if (!actionFreq[text]) {
              actionFreq[text] = { count: 0, recentDate: a.created_at };
            }
            actionFreq[text].count += 1;
            if (new Date(a.created_at) > new Date(actionFreq[text].recentDate)) {
              actionFreq[text].recentDate = a.created_at;
            }
          });
        });
      } else {
        const { data: recentActions, error: recentError } = await supabase
          .from('grievance_actions')
          .select('action_text, created_at')
          .in('grievance_id', (
            await supabase
              .from('grievances')
              .select('id')
              .eq('category_id', categoryId)
              .gte('created_at', sixMonthsAgo.toISOString())
          ).data?.map(g => g.id) || [])
          .gte('created_at', sixMonthsAgo.toISOString())
          .not('action_text', 'ilike', '%Grievance reopened by user%')
          .order('created_at', { ascending: false })
          .limit(5);

        if (recentError) throw recentError;

        (recentActions || []).forEach(a => {
          const text = a.action_text.trim();
          if (!actionFreq[text]) {
            actionFreq[text] = { count: 0, recentDate: a.created_at };
          }
          actionFreq[text].count += 1;
          if (new Date(a.created_at) > new Date(actionFreq[text].recentDate)) {
            actionFreq[text].recentDate = a.created_at;
          }
        });
      }

      const uniqueActions = Object.entries(actionFreq)
        .map(([text, { count, recentDate }]) => ({
          action: text,
          count,
          recentDate,
        }))
        .filter(a => a.action.length > 10 && new Date(a.recentDate) > sixMonthsAgo)
        .sort((a, b) => b.count - a.count || new Date(b.recentDate).getTime() - new Date(a.recentDate).getTime())
        .slice(0, 5);

      if (uniqueActions.length > 0) {
        await supabase
          .from('grievance_suggested_actions')
          .insert({
            grievance_id: id,
            suggested_actions: uniqueActions,
            created_at: new Date().toISOString(),
          });
      }

      setSuggestedActions(uniqueActions);
    } catch (err) {
      console.error('Error fetching suggested actions:', err);
      setSuggestedActions([]);
    } finally {
      setRecLoading(false);
    }
  };

  const handleDelegate = async (toEmployeeId: string) => {
    try {
      const sessionResponse = await supabase.auth.getSession();
      const session = sessionResponse.data.session;
      if (!session) throw new Error('User not authenticated.');
      if (!['Lead', 'Senior'].includes(profile?.designation || '')) {
        throw new Error('Only Lead or Senior can delegate grievances.');
      }

      const { data: grievanceData } = await supabase
        .from('grievances')
        .select('assigned_employee_id, user_id, profiles:profiles!grievances_user_id_fkey1 (id, email, role)')
        .eq('id', id)
        .single();

      const previousAssignedEmployeeId = grievanceData?.assigned_employee_id;
      const submitterId = grievanceData?.user_id;
      const submitterProfile = Array.isArray(grievanceData?.profiles) ? grievanceData.profiles[0] : grievanceData?.profiles;

      const { error: updateError } = await supabase
        .from('grievances')
        .update({ assigned_employee_id: toEmployeeId })
        .eq('id', id);

      if (updateError) throw new Error(`Grievance update failed: ${updateError.message}`);

      const { error: delegationError } = await supabase
        .from('grievance_delegations')
        .insert({
          grievance_id: id,
          from_employee_id: session.user.id,
          to_employee_id: toEmployeeId,
        });

      if (delegationError) throw new Error(`Delegation insert failed: ${delegationError.message}`);

      const { data: toEmployee } = await supabase
        .from('profiles')
        .select('designation, email, name')
        .eq('id', toEmployeeId)
        .single();

      if (!toEmployee) throw new Error('Assignee profile not found.');

      const parentId = session.user.id;
      const { error: hierarchyError } = await supabase
        .from('department_hierarchy')
        .upsert(
          [
            {
              employee_id: toEmployeeId,
              parent_employee_id: parentId,
              category_id: profile?.category_id,
            },
          ],
          { onConflict: 'employee_id,category_id' }
        );

      if (hierarchyError) throw new Error(`Hierarchy upsert failed: ${hierarchyError.message}`);

      const message = `Grievance #${id} has been delegated to you.`;
      await triggerNotification(toEmployeeId, toEmployee.email, message, Number(id), 'Delegation');

      if (profile?.designation === 'Lead' && submitterId && submitterProfile?.role === 'user') {
        const submitterEmail = submitterProfile.email;
        if (submitterEmail) {
          const userMessage = `Your Grievance #${id} has been assigned to ${toEmployee.name} (${toEmployee.designation}).`;
          await triggerNotification(submitterId, submitterEmail, userMessage, Number(id), 'Assignment');
        }
      }

      if (previousAssignedEmployeeId && previousAssignedEmployeeId !== toEmployeeId) {
        const { data: previousEmployee } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', previousAssignedEmployeeId)
          .single();
        if (previousEmployee) {
          const prevMessage = `Grievance #${id} has been reassigned from you.`;
          await triggerNotification(previousAssignedEmployeeId, previousEmployee.email, prevMessage, Number(id), 'Reassignment');
        }
      }

      alert('Grievance delegated successfully!');
      fetchGrievance();
    } catch (error: any) {
      console.error('Error delegating grievance:', error);
      setError(error.message || 'Failed to delegate grievance.');
    }
  };

  const triggerNotification = async (userId: string, email: string, messageTemplate: string, grievanceId: number, type: string) => {
    try {
      const { data: grievanceData, error: grievanceError } = await supabase
        .from('grievances')
        .select('title')
        .eq('id', grievanceId)
        .single();

      if (grievanceError || !grievanceData) throw new Error('Error fetching grievance title.');

      const grievanceTitle = grievanceData.title;
      const message = messageTemplate.replace(`#${grievanceId}`, `'${grievanceTitle}'`);

      const { error: dbError } = await supabase.from('notifications').insert({
        user_id: userId,
        message,
        grievance_id: grievanceId,
        is_read: false,
        created_at: new Date().toISOString(),
      });

      if (dbError) throw dbError;

      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, subject: `Grievance Update: ${type}`, message }),
      });
    } catch (error) {
      console.error('Error triggering notification:', error);
    }
  };

  const handleActionSubmit = async () => {
    try {
      const sessionResponse = await supabase.auth.getSession();
      const session = sessionResponse.data.session;
      if (!session) throw new Error('User not authenticated.');

      if (!actionInput.trim()) throw new Error('Action text cannot be empty.');

      const { data: grievanceData, error: grievanceError } = await supabase
        .from('grievances')
        .select(`
          status,
          user_id,
          profiles:profiles!grievances_user_id_fkey1 (id, email, role)
        `)
        .eq('id', id)
        .single();

      if (grievanceError) throw new Error(`Failed to fetch grievance: ${grievanceError.message}`);
      if (!grievanceData) throw new Error('Grievance not found.');

      const oldStatus = grievanceData.status;
      const submitterId = grievanceData.user_id;
      const submitterProfile = Array.isArray(grievanceData.profiles) ? grievanceData.profiles[0] : grievanceData.profiles;

      if (!submitterProfile || submitterProfile.role !== 'user') {
        throw new Error('Submitter profile not found or not a user.');
      }

      const submitterEmail = submitterProfile.email;
      if (!submitterEmail) throw new Error('Submitter email not found.');

      const { error: actionError } = await supabase
        .from('grievance_actions')
        .insert({
          grievance_id: id,
          employee_id: session.user.id,
          action_text: actionInput,
        });

      if (actionError) throw new Error(`Action insert failed: ${actionError.message}`);

      let updateData: { status: string; updated_at: string; grievance_resolved_file?: string } = {
        status: statusInput,
        updated_at: new Date().toISOString(),
      };

      if (statusInput === 'Resolved' && resolvedFile) {
        if (!resolvedFile) throw new Error('Resolution file is required when marking as Resolved.');
        
        const fileExt = resolvedFile.name.split('.').pop();
        const fileName = `resolution-${id}-${Date.now()}.${fileExt}`;
        const filePath = `grievance-${id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('grievance-documents')
          .upload(filePath, resolvedFile);

        if (uploadError) throw new Error(`File upload failed: ${uploadError.message}`);

        const { data: publicUrlData } = supabase.storage
          .from('grievance-documents')
          .getPublicUrl(filePath);

        if (!publicUrlData) throw new Error('Failed to get public URL for uploaded file.');

        updateData.grievance_resolved_file = publicUrlData.publicUrl;
      } else if (statusInput === 'Resolved' && !resolvedFile) {
        throw new Error('A resolution file must be provided when marking as Resolved.');
      }

      const { error: statusError } = await supabase
        .from('grievances')
        .update(updateData)
        .eq('id', id)
        .eq('assigned_employee_id', session.user.id);

      if (statusError) throw new Error(`Status update failed: ${statusError.message}`);

      if (submitterId && submitterEmail) {
        const actionMessage = `New action added to Grievance #${id}: ${actionInput}`;
        await triggerNotification(submitterId, submitterEmail, actionMessage, Number(id), 'Action');

        if (oldStatus !== statusInput) {
          const statusMessage = `Grievance #${id} status changed from ${oldStatus} to ${statusInput}.`;
          await triggerNotification(submitterId, submitterEmail, statusMessage, Number(id), 'Status Change');
        }
      }

      alert('Action added successfully!');
      setActionInput('');
      setStatusInput('Pending');
      setResolvedFile(null);
      fetchGrievance();
    } catch (error: any) {
      console.error('Error submitting action:', error);
      setError(error.message || 'Failed to submit action.');
    }
  };

  const fetchGrievance = async () => {
    try {
      setLoading(true);
      const sessionResponse = await supabase.auth.getSession();
      const session = sessionResponse.data.session;
      if (!session) throw new Error('User not authenticated.');

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, category_id, designation, name, email')
        .eq('id', session.user.id)
        .single();

      if (profileError || !profileData) throw new Error('Profile not found.');
      setProfile(profileData);

      const { data: grievanceData, error: grievanceError } = await supabase
        .from('grievances')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          created_at,
          user_id,
          assigned_employee_id,
          category_id,
          grievance_resolved_file,
          profiles!grievances_assigned_employee_id_fkey (name, designation, location, email),
          submitter:profiles!grievances_user_id_fkey1 (id, email),
          grievance_delegations!grievance_id (
            from_employee_id,
            to_employee_id,
            from_profile:from_employee_id (name, designation),
            to_profile:to_employee_id (name, designation)
          ),
          grievance_actions!grievance_id (
            id,
            action_text,
            created_at,
            employee:profiles!grievance_actions_employee_id_fkey (name, designation)
          )
        `)
        .eq('id', id)
        .single();

      if (grievanceError) throw grievanceError;

      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id, name')
        .eq('id', grievanceData.category_id)
        .single();

      if (categoryError) throw categoryError;

      grievanceData.categories = categoryData;

      const { data: files, error: storageError } = await supabase.storage
        .from('grievance-documents')
        .list(`grievance-${id}`);

      if (storageError) throw storageError;

      const documents = files?.map(file => ({
        name: file.name,
        url: supabase.storage.from('grievance-documents').getPublicUrl(`grievance-${id}/${file.name}`).data.publicUrl,
      })) || [];

      let hierarchy: TreeNode = { name: 'Unassigned', designation: '', children: [] };
      const delegations = Array.isArray(grievanceData.grievance_delegations) ? grievanceData.grievance_delegations : [];

      if (delegations.length > 0) {
        const employeeMap = new Map<string, TreeNode>();
        delegations.forEach((d: any) => {
          if (d.from_employee_id && d.from_profile) {
            employeeMap.set(d.from_employee_id, {
              name: d.from_profile.name,
              designation: d.from_profile.designation,
              children: [],
            });
          }
          if (d.to_employee_id && d.to_profile) {
            employeeMap.set(d.to_employee_id, {
              name: d.to_profile.name,
              designation: d.to_profile.designation,
              children: [],
            });
          }
        });

        delegations.forEach((d: any) => {
          const fromNode = d.from_employee_id ? employeeMap.get(d.from_employee_id) : null;
          const toNode = d.to_employee_id ? employeeMap.get(d.to_employee_id) : null;
          if (fromNode && toNode) {
            fromNode.children = fromNode.children || [];
            if (!fromNode.children.some(child => child.name === toNode.name)) {
              fromNode.children.push(toNode);
            }
          }
        });

        const firstDelegation = delegations[0];
        if (firstDelegation.from_employee_id) {
          hierarchy = employeeMap.get(firstDelegation.from_employee_id) || hierarchy;
        }
      } else if (grievanceData.profiles) {
        hierarchy = { name: grievanceData.profiles.name, designation: grievanceData.profiles.designation, children: [] };
      }

      const actions = Array.isArray(grievanceData.grievance_actions)
        ? grievanceData.grievance_actions
            .map((a: any) => ({
              id: a.id,
              action_text: a.action_text,
              created_at: a.created_at,
              employee: a.employee,
            }))
            .sort((a: GrievanceAction, b: GrievanceAction) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
        : [];

      setGrievance({
        ...grievanceData,
        categories: Array.isArray(grievanceData.categories) ? grievanceData.categories[0] : grievanceData.categories,
        profiles: Array.isArray(grievanceData.profiles) ? grievanceData.profiles[0] : grievanceData.profiles,
        submitter: Array.isArray(grievanceData.submitter) ? grievanceData.submitter[0] : grievanceData.submitter,
        assigned_by: delegations[0]?.from_profile
          ? { name: delegations[0].from_profile.name, designation: delegations[0].from_profile.designation }
          : undefined,
        hierarchy,
        actions,
        documents,
      });

      const { data: employeesData, error: employeesError } = await supabase
        .from('profiles')
        .select('id, name, designation')
        .eq('category_id', profileData.category_id)
        .eq('role', 'employee')
        .neq('id', session.user.id)
        .in('designation', profileData.designation === 'Lead' ? ['Senior', 'Junior'] : ['Junior']);

      if (employeesError) throw employeesError;
      setEmployees(employeesData || []);

      fetchSuggestedActions(grievanceData);
    } catch (error: any) {
      console.error('Error fetching grievance:', error);
      setError(error.message || 'Failed to load grievance.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute role="employee">
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
          <Header role="employee" />
          <p className="text-gray-600 text-lg animate-pulse text-center mt-8">Loading grievance...</p>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !grievance) {
    return (
      <ProtectedRoute role="employee">
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
          <Header role="employee" />
          <p className="text-red-600 bg-red-100 p-4 rounded-lg mb-6 shadow-inner text-center mt-8 animate-fade-in">
            {error || 'Grievance not found.'}
          </p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute role="employee">
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
        <Header role="employee" />
        <div className="max-w-4xl mx-auto p-8">
          <Link
            href="/dashboard/employee"
            className="inline-block mb-6 text-indigo-600 hover:text-indigo-800 transition-all duration-300"
          >
            ← Back to Dashboard
          </Link>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h1 className="text-3xl font-semibold text-gray-800 mb-4">{grievance.title}</h1>
            <div className="space-y-4">
              <div>
                <span className="font-medium text-gray-600">Description:</span>
                <p className="text-gray-800 mt-1">{grievance.description || 'No description provided.'}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-600">Category:</span>
                <span className="text-gray-800">{grievance.categories.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-600">Status:</span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    grievance.status === 'Pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : grievance.status === 'In Progress'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {grievance.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-600">Priority:</span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    grievance.priority === 'High'
                      ? 'bg-red-100 text-red-800'
                      : grievance.priority === 'Medium'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {grievance.priority}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-600">Assigned To:</span>
                <span className="text-gray-800">
                  {grievance.profiles
                    ? `${grievance.profiles.name} (${grievance.profiles.designation})`
                    : 'Unassigned'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-600">Assigned By:</span>
                <span className="text-gray-800">
                  {grievance.assigned_by
                    ? `${grievance.assigned_by.name} (${grievance.assigned_by.designation})`
                    : 'N/A'}
                </span>
              </div>
              {grievance.documents && grievance.documents.length > 0 && (
                <div>
                  <span className="font-medium text-gray-600">Uploaded Documents:</span>
                  <ul className="list-disc ml-6 mt-1">
                    {grievance.documents.map((doc, idx) => (
                      <li key={idx}>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          {doc.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {grievance.grievance_resolved_file && (
                <div>
                  <span className="font-medium text-gray-600">Resolution Document:</span>
                  <a
                    href={grievance.grievance_resolved_file}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 ml-2"
                  >
                    View Resolution Document
                  </a>
                </div>
              )}
            </div>

            <div className="mt-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Delegation Hierarchy</h3>
              <div className="border border-gray-200 rounded-lg p-4" style={{ height: '400px', width: '100%' }}>
                <Tree
                  data={grievance.hierarchy}
                  orientation="vertical"
                  translate={{ x: 350, y: 50 }}
                  pathFunc="step"
                  nodeSize={{ x: 200, y: 100 }}
                  renderCustomNodeElement={({ nodeDatum }) => (
                    <g>
                      <circle r="15" fill="#4f46e5" />
                      <text fill="black" strokeWidth="0" x="0" y="30" textAnchor="middle">
                        {nodeDatum.name} ({(nodeDatum as TreeNode).designation || ''})
                      </text>
                    </g>
                  )}
                />
              </div>
            </div>

            {grievance.assigned_employee_id === profile?.id && (
              <div className="mt-6 space-y-4">
                <h3 className="text-xl font-semibold text-gray-800">Add Action</h3>
                <textarea
                  value={actionInput}
                  onChange={(e) => setActionInput(e.target.value)}
                  placeholder="Enter action taken"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <select
                  value={statusInput}
                  onChange={(e) => setStatusInput(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
                {statusInput === 'Resolved' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Upload Resolution Document
                    </label>
                    <input
                      type="file"
                      onChange={(e) => setResolvedFile(e.target.files ? e.target.files[0] : null)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      accept=".pdf,.doc,.docx"
                    />
                  </div>
                )}
                <button
                  onClick={handleActionSubmit}
                  className="w-full p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-300"
                >
                  Submit Action
                </button>
              </div>
            )}

            {['Lead', 'Senior'].includes(profile?.designation || '') && (
              <div className="mt-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Delegate Grievance</h3>
                <select
                  onChange={(e) => handleDelegate(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Delegate To
                  </option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.designation})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {grievance.actions && grievance.actions.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Action History</h3>
                <div className="overflow-y-auto border border-gray-200 rounded-lg max-h-[200px] scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
                  <table className="w-full bg-white">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700 text-left text-xs uppercase">
                        <th className="p-3">Action</th>
                        <th className="p-3">Employee</th>
                        <th className="p-3">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grievance.actions.map((action) => (
                        <tr key={action.id} className="border-t text-sm text-gray-600">
                          <td className="p-3">{action.action_text}</td>
                          <td className="p-3">
                            {action.employee.name} ({action.employee.designation})
                          </td>
                          <td className="p-3">{new Date(action.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Suggested Actions</h3>
              {recLoading ? (
                <p className="text-gray-600 text-sm animate-pulse">Loading suggested actions...</p>
              ) : suggestedActions.length === 0 ? (
                <p className="text-gray-600 text-sm">No suggested actions available.</p>
              ) : (
                <div className="p-4 bg-indigo-50 rounded-lg">
                  <h4 className="font-semibold text-indigo-700 text-sm mb-2">Recommended Actions:</h4>
                  <ul className="list-disc ml-4 text-indigo-700 text-sm">
                    {suggestedActions.map((action, idx) => (
                      <li key={idx} className="mb-1">
                        {action.action}{' '}
                        <span className="text-xs text-indigo-500">
                          (Used {action.count} time{action.count !== 1 ? 's' : ''}, last on{' '}
                          {new Date(action.recentDate).toLocaleDateString()})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-down {
          animation: fadeInDown 1s ease-out;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 8px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: #a0aec0;
          border-radius: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background-color: #edf2f7;
        }
      `}</style>
    </ProtectedRoute>
  );
}