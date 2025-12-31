// lib/timeline.ts
import { prisma } from "./prisma";

interface TimelineActivityData {
  entityType: 'EMPLOYEE' | 'RESOURCE' | 'ACCESS' | 'POLICY' | 'DOCUMENT' | 'APPROVAL_WORKFLOW';
  entityId: string;
  activityType: string;
  title: string;
  description?: string;
  metadata?: any;
  performedBy: string;
  // Optional specific entity IDs for easier querying
  policyId?: string;
  documentId?: string;
  resourceId?: string;
  workflowId?: string;
  employeeId?: string;
}

export async function logTimelineActivity(data: TimelineActivityData) {
  try {
    await prisma.activityTimeline.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        activityType: data.activityType as any,
        title: data.title,
        description: data.description || null,
        metadata: data.metadata || null,
        performedBy: data.performedBy,
        policyId: data.policyId || null,
        documentId: data.documentId || null,
        resourceId: data.resourceId || null,
        workflowId: data.workflowId || null,
        employeeId: data.employeeId || null,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to log timeline activity:', error);
    // Don't throw error to avoid breaking the main operation
  }
}

export async function getEntityTimeline(entityType: string, entityId: string, limit = 15, page = 1) {
  try {
    const skip = (page - 1) * limit;
    
    const activities = await prisma.activityTimeline.findMany({
      where: {
        entityType: entityType as any,
        entityId: entityId
      },
      include: {
        performer: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      skip,
      take: limit
    });

    // Handle cases where performer employee might be deleted
    const processedActivities = activities.map((activity: any) => {
      if (!activity.performer) {
        let employeeName = 'Deleted Employee';
        let employeeDepartment = 'Unknown Department';
        
        try {
          if (activity.metadata && typeof activity.metadata === 'object') {
            if (activity.metadata.employeeName) employeeName = `${activity.metadata.employeeName} (Deleted)`;
            if (activity.metadata.department) employeeDepartment = activity.metadata.department;
          }
        } catch (e) {
          // Ignore errors
        }

        return {
          ...activity,
          performer: {
            id: activity.performedBy,
            name: employeeName,
            email: 'deleted@employee.com',
            department: employeeDepartment
          }
        };
      }
      return activity;
    });

    return processedActivities;
  } catch (error) {
    console.error('Failed to fetch entity timeline:', error);
    return [];
  }
}

export async function getEntityTimelineCount(entityType: string, entityId: string) {
  try {
    return await prisma.activityTimeline.count({
      where: {
        entityType: entityType as any,
        entityId: entityId
      }
    });
  } catch (error) {
    console.error('Failed to count entity timeline:', error);
    return 0;
  }
}

export async function getAllTimeline(limit = 50, page = 1) {
  try {
    const skip = (page - 1) * limit;
    
    const activities = await prisma.activityTimeline.findMany({
      include: {
        performer: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      skip,
      take: limit
    });

    // Handle cases where performer employee might be deleted
    const processedActivities = activities.map((activity: any) => {
      if (!activity.performer) {
        // Try to extract employee info from metadata if available
        let employeeName = 'Deleted Employee';
        let employeeDepartment = 'Unknown Department';
        
        try {
          if (activity.metadata && typeof activity.metadata === 'object') {
            if (activity.metadata.employeeName) employeeName = `${activity.metadata.employeeName} (Deleted)`;
            if (activity.metadata.department) employeeDepartment = activity.metadata.department;
          }
        } catch (e) {
          // Ignore errors
        }

        return {
          ...activity,
          performer: {
            id: activity.performedBy,
            name: employeeName,
            email: 'deleted@employee.com',
            department: employeeDepartment
          }
        };
      }
      return activity;
    });

    return processedActivities;
  } catch (error) {
    console.error('Failed to fetch timeline:', error);
    console.error('Stack trace:', (error as Error).stack);
    return [];
  }
}

export async function getAllTimelineCount() {
  try {
    return await prisma.activityTimeline.count();
  } catch (error) {
    console.error('Failed to count all timeline:', error);
    return 0;
  }
}

export async function getTimelineByEntityType(entityType: string, limit = 15, page = 1) {
  try {
    const skip = (page - 1) * limit;
    
    const activities = await prisma.activityTimeline.findMany({
      where: {
        entityType: entityType as any
      },
      include: {
        performer: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      skip,
      take: limit
    });

    return activities;
  } catch (error) {
    console.error('Failed to fetch timeline by entity type:', error);
    return [];
  }
}

export async function getUserTimeline(userId: string, limit = 15, page = 1) {
  try {
    const skip = (page - 1) * limit;
    
    const activities = await prisma.activityTimeline.findMany({
      where: {
        performedBy: userId
      },
      include: {
        performer: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      skip,
      take: limit
    });

    // Handle cases where performer employee might be deleted
    const processedActivities = activities.map((activity: any) => {
      if (!activity.performer) {
        let employeeName = 'Deleted Employee';
        let employeeDepartment = 'Unknown Department';
        
        try {
          if (activity.metadata && typeof activity.metadata === 'object') {
            if (activity.metadata.employeeName) employeeName = `${activity.metadata.employeeName} (Deleted)`;
            if (activity.metadata.department) employeeDepartment = activity.metadata.department;
          }
        } catch (e) {
          // Ignore errors
        }

        return {
          ...activity,
          performer: {
            id: activity.performedBy,
            name: employeeName,
            email: 'deleted@employee.com',
            department: employeeDepartment
          }
        };
      }
      return activity;
    });

    return processedActivities;
  } catch (error) {
    console.error('Failed to fetch user timeline:', error);
    return [];
  }
}

export async function getUserTimelineCount(userId: string) {
  try {
    return await prisma.activityTimeline.count({
      where: {
        performedBy: userId
      }
    });
  } catch (error) {
    console.error('Failed to count user timeline:', error);
    return 0;
  }
}

export async function getTimelineByEntityTypeCount(entityType: string) {
  try {
    return await prisma.activityTimeline.count({
      where: {
        entityType: entityType as any
      }
    });
  } catch (error) {
    console.error('Failed to count timeline by entity type:', error);
    return 0;
  }
}

// Helper functions for common timeline activities
export async function logCreatedActivity(
  entityType: TimelineActivityData['entityType'],
  entityId: string,
  entityName: string,
  performedBy: string,
  additionalData?: any
) {
  return logTimelineActivity({
    entityType,
    entityId,
    activityType: 'CREATED',
    title: `Created ${entityType.toLowerCase()}: ${entityName}`,
    description: `New ${entityType.toLowerCase()} was created`,
    metadata: additionalData,
    performedBy,
    ...(entityType === 'POLICY' && { policyId: entityId }),
    ...(entityType === 'DOCUMENT' && { documentId: entityId }),
    ...(entityType === 'RESOURCE' && { resourceId: entityId }),
    ...(entityType === 'APPROVAL_WORKFLOW' && { workflowId: entityId }),
    ...(entityType === 'EMPLOYEE' && { employeeId: entityId })
  });
}

export async function logUpdatedActivity(
  entityType: TimelineActivityData['entityType'],
  entityId: string,
  entityName: string,
  performedBy: string,
  changes: { field: string; oldValue: any; newValue: any }[],
  additionalData?: any
) {
  return logTimelineActivity({
    entityType,
    entityId,
    activityType: 'UPDATED',
    title: `Updated ${entityType.toLowerCase()}: ${entityName}`,
    description: `Modified ${changes.length} field(s): ${changes.map(c => c.field).join(', ')}`,
    metadata: { changes, ...additionalData },
    performedBy,
    ...(entityType === 'POLICY' && { policyId: entityId }),
    ...(entityType === 'DOCUMENT' && { documentId: entityId }),
    ...(entityType === 'RESOURCE' && { resourceId: entityId }),
    ...(entityType === 'APPROVAL_WORKFLOW' && { workflowId: entityId }),
    ...(entityType === 'EMPLOYEE' && { employeeId: entityId })
  });
}

export async function logStatusChangedActivity(
  entityType: TimelineActivityData['entityType'],
  entityId: string,
  entityName: string,
  performedBy: string,
  oldStatus: string,
  newStatus: string,
  additionalData?: any
) {
  return logTimelineActivity({
    entityType,
    entityId,
    activityType: 'STATUS_CHANGED',
    title: `Status changed for ${entityType.toLowerCase()}: ${entityName}`,
    description: `Status changed from ${oldStatus} to ${newStatus}`,
    metadata: { oldStatus, newStatus, ...additionalData },
    performedBy,
    ...(entityType === 'POLICY' && { policyId: entityId }),
    ...(entityType === 'DOCUMENT' && { documentId: entityId }),
    ...(entityType === 'RESOURCE' && { resourceId: entityId }),
    ...(entityType === 'APPROVAL_WORKFLOW' && { workflowId: entityId }),
    ...(entityType === 'EMPLOYEE' && { employeeId: entityId })
  });
}

export async function logFileUploadedActivity(
  entityType: TimelineActivityData['entityType'],
  entityId: string,
  entityName: string,
  performedBy: string,
  fileName: string,
  fileSize: number,
  additionalData?: any
) {
  return logTimelineActivity({
    entityType,
    entityId,
    activityType: 'FILE_UPLOADED',
    title: `File uploaded for ${entityType.toLowerCase()}: ${entityName}`,
    description: `Uploaded file: ${fileName} (${Math.round(fileSize / 1024)} KB)`,
    metadata: { fileName, fileSize, ...additionalData },
    performedBy,
    ...(entityType === 'POLICY' && { policyId: entityId }),
    ...(entityType === 'DOCUMENT' && { documentId: entityId }),
    ...(entityType === 'RESOURCE' && { resourceId: entityId })
  });
}