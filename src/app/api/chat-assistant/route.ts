import { NextRequest, NextResponse } from 'next/server';
import { extractKeywords, simpleSentiment, analyzePriority } from '@/lib/ai-utils-server';
import { ChatRequest, ChatResponse, UserRole } from '@/types/chat';

export async function POST(req: NextRequest) {
  try {
    const { query, userRole, chatHistory } = await req.json() as ChatRequest;
    
    if (!query) {
      return NextResponse.json(
        { error: 'No query provided' },
        { status: 400 }
      );
    }

    // Get the context from analyzing the query
    const keywords = extractKeywords(query);
    const sentiment = simpleSentiment(query);
    const priority = await analyzePriority(query);
    
    // Generate a response based on the query and context
    const response = await generateChatResponse(query, userRole || 'user', keywords, sentiment, priority, chatHistory);
    
    // Generate suggested follow-up questions
    const suggestedQuestions = generateSuggestedQuestions(query, response);
    
    const chatResponse: ChatResponse = {
      response,
      suggestedQuestions
    };
    
    return NextResponse.json(chatResponse);
  } catch (error) {
    console.error('Chat assistant error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' } as ChatResponse,
      { status: 500 }
    );
  }
}

async function generateChatResponse(
  query: string, 
  role: UserRole,
  keywords: string[],
  sentiment: string,
  priority: string,
  chatHistory: any[] = []
): Promise<string> {
  const lowercaseQuery = query.toLowerCase();
  
  // Knowledge base responses
  if (lowercaseQuery.includes('submit') && lowercaseQuery.includes('grievance')) {
    if (role === 'user') {
      return 'To submit a grievance, go to your dashboard and click on "Submit Grievance". Fill in the required details including title, description, category, and location. You can also upload supporting documents. Our AI will automatically suggest a priority based on your description.';
    } else {
      return 'Users can submit grievances from their dashboard. As an employee/admin, you can view and manage these submissions from your assigned cases.';
    }
  } else if (lowercaseQuery.includes('track') || lowercaseQuery.includes('status')) {
    return 'You can track your grievance status by clicking on "Track Grievance" from the dashboard. Each grievance shows its current status, assigned employee, and action history.';
  } else if (lowercaseQuery.includes('upload') || lowercaseQuery.includes('document') || lowercaseQuery.includes('file')) {
    return 'You can upload supporting documents when submitting a grievance. We accept PDFs, Word documents, images (JPG/PNG), and text files up to 5MB in size. Our system will analyze the content to help categorize your grievance.';
  } else if (lowercaseQuery.includes('category') || lowercaseQuery.includes('department')) {
    return 'Grievances are categorized by department to ensure they reach the right team. The category selection is available when you submit a grievance. Choose the most relevant category for faster processing.';
  } else if (lowercaseQuery.includes('assign') || (lowercaseQuery.includes('who') && lowercaseQuery.includes('handle'))) {
    return 'Grievances are assigned based on category and priority. Department leads receive them first and may handle them directly or delegate to senior or junior employees within their department.';
  } else if (lowercaseQuery.includes('priority')) {
    return 'Grievance priority is determined by AI analysis of the description. Priorities can be Low, Medium, or High, which affects how quickly they\'re addressed. High priority grievances receive immediate attention.';
  } else if (lowercaseQuery.includes('notification')) {
    return 'You\'ll receive notifications when there are updates to your grievances. Click the bell icon in the header to view your notifications. You can mark them as read by clicking on them.';
  } else if (lowercaseQuery.includes('role') || lowercaseQuery.includes('permission')) {
    return 'The platform has three main roles: Users (who submit grievances), Employees (who handle cases), and Admins (who oversee the system). Each role has different permissions and dashboard views.';
  } else if (lowercaseQuery.includes('anonymous')) {
    return 'Yes, you can submit grievances anonymously by checking the "Submit Anonymously" option during submission. Your identity will not be visible to anyone handling the case.';
  } else if (lowercaseQuery.includes('translate') || lowercaseQuery.includes('language')) {
    return 'The platform supports multilingual submissions. You can select your preferred language when submitting a grievance. Currently, we support English and Tamil, with automatic translation capabilities.';
  } else if (lowercaseQuery.includes('hello') || lowercaseQuery.includes('hi') || lowercaseQuery.includes('hey')) {
    return `Hello! I'm your Grievance Portal AI Assistant. How can I help you today with managing your grievances?`;
  } else if (role === 'employee' && (lowercaseQuery.includes('delegate') || lowercaseQuery.includes('assign to'))) {
    return 'As an employee, you can delegate grievances to team members by selecting the grievance and clicking "Delegate". You can only delegate to employees with roles junior to yours within the same department.';
  } else if (role === 'admin' && lowercaseQuery.includes('analytics')) {
    return 'As an admin, you can access analytics through the "Problem Hotspots" page. This uses K-means clustering to identify common issues and patterns in grievances, helping you make data-driven decisions.';
  } else if (lowercaseQuery.includes('help') || lowercaseQuery.includes('assist')) {
    return 'I can help with information about submitting grievances, tracking status, uploading documents, understanding roles, and navigating the system. What specific information do you need?';
  } else if (lowercaseQuery.includes('thank')) {
    return 'You\'re welcome! Is there anything else I can help you with regarding the grievance system?';
  } else {
    // Enhanced context-aware response
    if (keywords.some(k => ['submission', 'submit', 'create', 'new', 'start'].includes(k))) {
      return 'The grievance submission process is simple. From your dashboard, click "Submit New" and fill in the required details. Would you like me to walk you through specific parts of the submission form?';
    }
    
    if (priority === 'High' && sentiment === 'negative') {
      return 'I understand you have an urgent concern. For immediate assistance, please submit your grievance with high priority, or contact our support team directly through the Help button in the footer.';
    }
    
    return 'I understand you\'re asking about the grievance portal. Could you please be more specific about what you\'d like to know? You can ask about submitting grievances, tracking status, uploading documents, or any other feature of the system.';
  }
}

function generateSuggestedQuestions(query: string, response: string): string[] {
  const combinedText = query.toLowerCase() + ' ' + response.toLowerCase();
  
  if (combinedText.includes('submit') && combinedText.includes('grievance')) {
    return ['What documents can I upload?', 'How is priority determined?', 'Can I submit anonymously?'];
  } else if (combinedText.includes('track') || combinedText.includes('status')) {
    return ['How are notifications sent?', 'What do the status levels mean?', 'Who handles my grievance?'];
  } else if (combinedText.includes('document') || combinedText.includes('upload')) {
    return ['What file types are supported?', 'Is there a file size limit?', 'How are documents analyzed?'];
  } else if (combinedText.includes('priority')) {
    return ['How are high priority cases handled?', 'Can I change the priority?', 'What makes a case high priority?'];
  } else if (combinedText.includes('assign') || combinedText.includes('delegate')) {
    return ['Who can see my grievance?', 'How long until someone responds?', 'Can I request a specific department?'];
  } else {
    // Default suggestions if no context match
    return ['How do I submit a grievance?', 'How do I track my grievances?', 'What documents can I upload?'];
  }
} 