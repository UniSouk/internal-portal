// lib/changeTracker.ts
import { prisma } from './prisma';
import { logAudit } from './audit';
import { logTimelineActivity } from './timeline';
import { getUserFromToken } from './auth';

interface ChangeTrackingData {
  entityType: 'EMPLOYEE' | 'RESOURCE' | 'ACCESS' | 'POLICY' | 'DOCUMENT' | 'APPROVAL_WORKFLOW';
  entityId: string;
  entityName: string;
  oldData: any;
  newData: any;
  performedBy: string;
  performerName?: string;
  performerRole?: string;
}

interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  displayName?: string;
}

export async function trackChanges(data: ChangeTrackingData) {
  try {
    // Get performer details if not provided
    let performerInfo = {
      name: data.performerName || 'Unknown User',
      role: data.performerRole || 'Unknown Role'
    };

    if (!data.performerName && data.performedBy) {
      const performer = await prisma.employee.findUnique({
        where: { id: data.performedBy },
        select: { name: true, role: true }
      });
      if (performer) {
        performerInfo = {
          name: performer.name,
          role: performer.role
        };
      }
    }

    // Calculate field-level changes
    const changes = calculateFieldChanges(data.oldData, data.newData);
    
    if (changes.length === 0) {
      return;
    }

    // Log each field change to audit
    for (const change of changes) {
      await logAudit({
        entityType: data.entityType,
        entityId: data.entityId,
        changedById: data.performedBy,
        fieldChanged: change.field,
        oldValue: formatValue(change.oldValue),
        newValue: formatValue(change.newValue)
      });
    }

    // Create comprehensive timeline entry
    const changeDescription = formatChangesForTimeline(changes, performerInfo);
    
    await logTimelineActivity({
      entityType: data.entityType,
      entityId: data.entityId,
      activityType: 'UPDATED',
      title: `Updated ${data.entityType.toLowerCase()}: ${data.entityName}`,
      description: changeDescription,
      metadata: {
        changes: changes,
        performedBy: performerInfo.name,
        performedByRole: performerInfo.role,
        changeCount: changes.length,
        timestamp: new Date().toISOString()
      },
      performedBy: data.performedBy,
      ...(data.entityType === 'EMPLOYEE' && { employeeId: data.entityId }),
      ...(data.entityType === 'RESOURCE' && { resourceId: data.entityId }),
      ...(data.entityType === 'POLICY' && { policyId: data.entityId }),
      ...(data.entityType === 'DOCUMENT' && { documentId: data.entityId }),
      ...(data.entityType === 'APPROVAL_WORKFLOW' && { workflowId: data.entityId })
    });

  } catch (error) {
    console.error('❌ Failed to track changes:', error);
    // Don't throw error to avoid breaking the main operation
  }
}

function calculateFieldChanges(oldData: any, newData: any): FieldChange[] {
  const changes: FieldChange[] = [];
  const allFields = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);

  for (const field of allFields) {
    const oldValue = oldData?.[field];
    const newValue = newData?.[field];

    // Skip if values are the same
    if (isEqual(oldValue, newValue)) {
      continue;
    }

    // Skip internal fields
    if (['id', 'createdAt', 'updatedAt'].includes(field)) {
      continue;
    }

    changes.push({
      field,
      oldValue,
      newValue,
      displayName: getFieldDisplayName(field)
    });
  }

  return changes;
}

function isEqual(a: any, b: any): boolean {
  // Handle null/undefined
  if (a === b) return true;
  if (a == null || b == null) return false;
  
  // Handle dates
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  
  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((val, i) => isEqual(val, b[i]));
  }
  
  // Handle objects
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    return keysA.length === keysB.length && keysA.every(key => isEqual(a[key], b[key]));
  }
  
  return false;
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value.toString();
  if (typeof value === 'number') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getFieldDisplayName(field: string): string {
  const displayNames: Record<string, string> = {
    name: 'Name',
    email: 'Email',
    role: 'Role',
    department: 'Department',
    status: 'Status',
    phone: 'Phone',
    managerId: 'Manager',
    title: 'Title',
    content: 'Content',
    category: 'Category',
    type: 'Type',
    description: 'Description',
    ownerId: 'Owner',
    assignedToId: 'Assigned To',
    permissionLevel: 'Permission Level',
    justification: 'Justification',
    version: 'Version',
    effectiveDate: 'Effective Date',
    expiryDate: 'Expiry Date',
    reviewDate: 'Review Date',
    serialNumber: 'Serial Number',
    modelNumber: 'Model Number',
    brand: 'Brand',
    location: 'Location',
    value: 'Value',
    monthlyRate: 'Monthly Rate',
    annualRate: 'Annual Rate',
    provider: 'Provider',
    serviceLevel: 'Service Level',
    softwareVersion: 'Software Version',
    licenseKey: 'License Key',
    licenseExpiry: 'License Expiry',
    subscriptionId: 'Subscription ID',
    subscriptionExpiry: 'Subscription Expiry'
  };
  
  return displayNames[field] || field.charAt(0).toUpperCase() + field.slice(1);
}

function formatChangesForTimeline(changes: FieldChange[], performer: { name: string; role: string }): string {
  const changeCount = changes.length;
  const changeList = changes.slice(0, 3).map(change => {
    const displayName = change.displayName || change.field;
    const oldVal = formatDisplayValue(change.oldValue);
    const newVal = formatDisplayValue(change.newValue);
    return `${displayName}: "${oldVal}" → "${newVal}"`;
  }).join(', ');
  
  const moreChanges = changeCount > 3 ? ` and ${changeCount - 3} more changes` : '';
  
  return `${performer.name} (${performer.role}) modified ${changeList}${moreChanges}`;
}

function formatDisplayValue(value: any): string {
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toString();
  if (value instanceof Date) return value.toLocaleDateString();
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === 'object') return '[Object]';
  
  const str = String(value);
  return str.length > 50 ? str.substring(0, 47) + '...' : str;
}

// Helper function to get current user from request
export async function getCurrentUserFromRequest(request: Request): Promise<{ id: string; name: string; role: string } | null> {
  try {
    const token = request.headers.get('cookie')?.split('auth-token=')[1]?.split(';')[0];
    if (!token) return null;
    
    const user = await getUserFromToken(token);
    return user;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}

// Wrapper function for easy integration
export async function trackEntityUpdate(
  entityType: ChangeTrackingData['entityType'],
  entityId: string,
  entityName: string,
  oldData: any,
  newData: any,
  request: Request
) {
  const currentUser = await getCurrentUserFromRequest(request);
  
  if (!currentUser) {
    console.warn('No authenticated user found for change tracking');
    return;
  }

  await trackChanges({
    entityType,
    entityId,
    entityName,
    oldData,
    newData,
    performedBy: currentUser.id,
    performerName: currentUser.name,
    performerRole: currentUser.role
  });
}