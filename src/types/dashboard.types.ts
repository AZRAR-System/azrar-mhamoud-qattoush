/**
 * � 2025 � Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System � All Rights Reserved
 * 
 * Dashboard Widget types
 */

export interface DashboardNote {
  id: string;
  content: string;
  priority: 'Normal' | 'Important' | 'Urgent';
  createdAt: string;
  isArchived: boolean;
}

export interface SystemReminder {
  id: string;
  title: string;
  date: string;
  type: 'Payment' | 'Call' | 'Visit' | 'Expiry' | 'Task';
  isDone: boolean;
  time?: string; // optional HH:mm
}

export interface ClientInteraction {
  id: string;
  clientId: string;
  clientName: string;
  type: 'Call' | 'Visit' | 'Complaint' | 'Service';
  details: string;
  date: string;
  status: 'Pending' | 'Resolved' | 'Logged';
}

export interface FollowUpTask {
  id: string;
  task: string;
  clientName?: string;
  phone?: string;
  type: 'Task' | 'Call' | 'Meeting' | 'Paperwork';
  dueDate: string;
  dueTime?: string; // optional HH:mm
  status: 'Pending' | 'Done';

  personId?: string;
  contractId?: string;
  propertyId?: string;
  priority?: 'High' | 'Medium' | 'Low';
  category?: string;
  note?: string;
  reminderId?: string;
  createdAt?: string;
  updatedAt?: string;
}
