# AI Assistant Component

The AI Assistant is a chat interface that helps users navigate the Grievance Portal with natural language questions and responses. It provides context-aware answers about submitting grievances, tracking status, uploading documents, and other features of the system.

## Features

- **Role-based responses**: Provides different answers based on user role (user, employee, or admin)
- **Persistent chat history**: Stores conversation history in browser localStorage
- **Typing animation**: Simulates a natural typing effect for AI responses
- **Context-aware suggestions**: Dynamically suggests relevant follow-up questions
- **Error handling**: Gracefully handles API errors
- **Responsive design**: Works well on both desktop and mobile devices

## Usage

Import and add the component to your layout or page:

```tsx
import AIAssistant from '@/components/AIAssistant';

export default function Dashboard() {
  // userRole can be 'user', 'employee', or 'admin'
  const userRole = 'user'; 
  
  return (
    <div>
      {/* Your page content */}
      <AIAssistant userRole={userRole} />
    </div>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `userRole` | `'user' \| 'employee' \| 'admin'` | `'user'` | Determines the context and accessible features for the assistant |

## Backend Integration

The AI Assistant component communicates with the backend through the `/api/chat-assistant` API endpoint. The endpoint processes user queries and returns appropriate responses based on the user's role and the content of their query.

### API Request Format

```typescript
{
  query: string;        // The user's question
  userRole: string;     // 'user', 'employee', or 'admin'
  chatHistory?: Array<{ // Previous messages in the conversation
    role: string;       // 'user' or 'assistant'
    content: string;    // Message text
    timestamp: string;  // ISO timestamp
  }>;
}
```

### API Response Format

```typescript
{
  response: string;               // The assistant's response
  suggestedQuestions?: string[];  // Follow-up questions to display as chips
  error?: string;                 // Error message, if any
}
```

## Customization

You can customize the appearance of the AI Assistant by modifying the Tailwind CSS classes in the component. The component uses Tailwind's utility classes for styling, making it easy to adapt to your design system.

Key areas for customization:
- Chat button: Modify the fixed position, colors, and shadow
- Chat window: Adjust the width, height, colors, and border radius
- Messages: Change the message bubble styles, colors, and typography
- Input area: Customize the input field, button, and placeholder text

## Knowledge Base

The AI Assistant's responses are based on a predefined knowledge base in the `generateChatResponse` function in the API route. You can expand this knowledge base by adding more conditions and responses to better answer user queries about specific features or workflows in your application. 