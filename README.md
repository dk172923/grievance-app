# Grievance Management Application

A modern, full-stack application for managing and tracking grievances efficiently across organizations. Built with Next.js, Supabase, and TypeScript.

![Grievance Management App](https://github.com/ukexe/grievance-app/raw/main/public/app-screenshot.png)

## Table of Contents
- [Features](#features)
- [Technology Stack](#technology-stack)
- [User Roles](#user-roles)
- [Installation](#installation)
- [Usage](#usage)
- [Key Functionalities](#key-functionalities)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [AI Integration](#ai-integration)
- [Data Visualization](#data-visualization)
- [Contributing](#contributing)
- [License](#license)

## Features

### For Users
- **Submit grievances** with detailed descriptions, document attachments, and location information
- **Track grievance status** in real-time with updates from employees handling the case
- **Multi-language support** - submit grievances in Tamil or English with automatic translation
- **Option for anonymous submission** to protect user identity
- **Document analysis** for uploaded files to extract key information automatically
- **Email notifications** for status updates

### For Employees
- **Hierarchical grievance management** with Lead, Senior, and Junior roles
- **Dashboard** showing assigned grievances with priority indicators
- **Action management** to document steps taken to resolve grievances
- **Delegation system** to assign grievances to other team members
- **Visualization tools** to identify patterns and hotspots in grievance data
- **Real-time notifications** for newly assigned or updated grievances

### For Administrators
- **Department management** to organize employees efficiently
- **Access to all grievances** across departments
- **Data analytics** with K-means clustering to identify problem patterns
- **System monitoring** and user management capabilities

## Technology Stack

- **Frontend**: Next.js 14 (React), TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, Supabase Functions
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage for document uploads
- **AI Features**: OpenAI integrations for text analysis and document processing
- **Visualization**: Recharts for data visualization, React-D3-Tree for hierarchy views
- **Deployment**: Vercel or any Node.js hosting

## User Roles

### User Role
- Can submit and track their own grievances
- Receives notifications about their grievance status

### Employee Role
Structured in a hierarchical system:
- **Lead**: Department head who can view all grievances in their department and delegate to Seniors
- **Senior**: Mid-level employee who can handle grievances and delegate to Juniors
- **Junior**: Entry-level employee who handles assigned grievances directly

### Admin Role
- Can access all parts of the system
- Can manage departments, categories, and user roles
- Has access to analytics and system management

## Installation

1. Clone the repository:
```bash
git clone https://github.com/ukexe/grievance-app.git
cd grievance-app
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Rename `.env.example` to `.env.local`
   - Fill in your Supabase and OpenAI API credentials

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Usage

### Authentication
- Sign up or login with email and password
- User profiles are automatically created with appropriate role assignments

### Submitting a Grievance
1. Login as a user
2. Navigate to "Submit Grievance" in the dashboard
3. Fill out the form with:
   - Title
   - Description
   - Category (department)
   - Location
   - Priority (auto-suggested by AI)
   - Optional document attachment
   - Language selection
4. Submit the form to create a new grievance

### Managing Grievances (Employees)
1. Login as an employee
2. View assigned grievances in your dashboard
3. Add actions to document steps taken
4. Update status (Pending, In Progress, Resolved, Closed)
5. For Lead/Senior: Delegate grievances to other employees

### Data Analysis (Employees & Admin)
1. Access the "Data Analysis" section
2. View K-means clustering visualization of grievance data
3. Adjust cluster numbers to identify patterns
4. Review summaries showing most common areas, categories, and keywords

## Key Functionalities

### Grievance Submission
The application allows users to submit detailed grievances, including document uploads which are automatically analyzed for content, sentiment, and key information extraction.

### Automatic Assignment
Grievances are automatically assigned to the Lead of the corresponding department, who can then reassign or delegate to other team members as needed.

### Hierarchical Delegation
A tree-based hierarchy visualization shows how grievances have been delegated through the organization, tracking the full history of assignments.

### Multi-Language Support
Users can submit grievances in Tamil, which are automatically translated to English for processing by employees.

### AI-Powered Priority Assessment
The system automatically analyzes grievance descriptions to suggest appropriate priority levels based on content and urgency.

### Document Analysis
Uploaded documents (PDFs, DOCX, images) are processed to extract text, summarize content, identify keywords, and analyze sentiment.

### Notification System
Real-time notifications alert employees about new assignments and users about status updates to their grievances.

### K-means Clustering Visualization
The application provides data visualization using K-means clustering to identify patterns in grievance data, helping administrators identify problem hotspots and trends.

## Database Schema

The application uses the following main tables:

### Profiles
- Stores user profile information including role (user/employee/admin)
- For employees, stores department and designation information

### Categories
- Represents departments or categories for grievances
- Each category can have multiple employees assigned

### Grievances
- Stores all grievance details including title, description, status
- Links to users who submitted them and employees assigned to handle them

### Grievance_Actions
- Tracks all actions taken by employees to resolve grievances
- Creates an audit trail of resolution efforts

### Grievance_Delegations
- Records the delegation history of grievances between employees
- Enables the hierarchical delegation visualization

### Department_Hierarchy
- Defines the reporting structure within departments
- Used for delegation permissions and visualization

## API Endpoints

The application includes several API endpoints for functionality:

### `/api/notify`
- Sends email notifications to users and employees

### `/api/analyze-document`
- Processes uploaded documents for text extraction and analysis

### `/api/translate`
- Provides translation services for multi-language support

## AI Integration

The application integrates several AI capabilities:

### Document Processing
- Text extraction from various document formats
- Summarization of document content
- Keyword extraction for tagging and classification
- Sentiment analysis to gauge emotional tone

### Priority Assessment
- Automatic assessment of grievance priority based on content analysis
- Considers urgency indicators, severity of issue, and potential impact

### Language Translation
- Tamil to English translation for grievances submitted in Tamil

## Data Visualization

### K-means Clustering
- Interactive scatter plot visualization of grievances
- Customizable cluster count to identify patterns
- Cluster summaries showing most common areas, categories, and keywords

### Delegation Hierarchy
- Tree visualization showing how grievances have been delegated
- Visual representation of organizational handling of issues

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.
