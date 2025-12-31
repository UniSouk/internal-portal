# Resource Management System - Data Flow Documentation

## 🏗️ Architecture Overview

The refactored resource management system follows a strict separation between **Resource Catalog** (templates) and **Resource Items** (physical instances), with a comprehensive approval workflow and audit trail.

## 📊 Domain Model

### Resource Catalog
- **Purpose**: Template/category level (e.g., "MacBook Pro 16-inch", "Figma License")
- **Contains**: Name, type, category, description, custodian
- **No Serial Numbers**: Catalog entries are templates, not physical items

### Resource Items (Physical Only)
- **Purpose**: Physical instances of hardware resources
- **Contains**: Serial number, hostname, IP address, specifications
- **Status Tracking**: AVAILABLE, ASSIGNED, MAINTENANCE, LOST, DAMAGED
- **One-to-Many**: Each catalog entry can have multiple items

### Resource Assignments
- **Purpose**: Links employees to resources/items
- **Created**: Only after approval workflow completion
- **Tracks**: Assignment date, return date, status, notes
- **Audit Trail**: Every assignment change is logged

## 🔄 Business Flow

### 1. Resource Request Flow
```
Employee Request → Access Request → Approval Workflow → Assignment Creation
```

**Detailed Steps:**
1. Employee submits access request via `/api/access`
2. System creates `ApprovalWorkflow` record with type `IT_EQUIPMENT_REQUEST`
3. Workflow routes to appropriate approver (manager/custodian/executive)
4. On approval, system calls `/api/resources/assignments/assign`
5. Assignment creation updates item status and logs audit trail

### 2. Assignment Creation (Transactional)
```sql
BEGIN TRANSACTION;
  -- Create assignment
  INSERT INTO ResourceAssignment (employeeId, resourceId, itemId, assignedBy, status);
  
  -- Update item status (if physical)
  UPDATE ResourceItem SET status = 'ASSIGNED' WHERE id = itemId;
  
  -- Log audit trail
  INSERT INTO AuditLog (entityType, entityId, changedById, fieldChanged, newValue);
  
  -- Log activity timeline
  INSERT INTO ActivityTimeline (entityType, entityId, activityType, title, performedBy);
COMMIT;
```

### 3. Return Process (Transactional)
```sql
BEGIN TRANSACTION;
  -- Update assignment
  UPDATE ResourceAssignment SET status = 'RETURNED', returnedAt = NOW();
  
  -- Update item status based on condition
  UPDATE ResourceItem SET status = 'AVAILABLE' WHERE id = itemId;
  
  -- Log audit trail
  INSERT INTO AuditLog (entityType, entityId, changedById, fieldChanged, oldValue, newValue);
  
  -- Log activity timeline
  INSERT INTO ActivityTimeline (entityType, entityId, activityType, title, performedBy);
COMMIT;
```

## 🌐 Frontend → API → Prisma Flow

### Resource Catalog Management

#### Frontend Component Flow:
```
ResourceCatalogPage → ResourceCatalogCard → ResourceCatalogForm
                   ↓
              API Calls to /api/resources/catalog
                   ↓
              Prisma Operations
```

#### API Route Structure:
- `GET /api/resources/catalog` - List catalog with availability calculations
- `POST /api/resources/catalog` - Create new catalog entry
- `GET /api/resources/catalog/[id]` - Get detailed resource with items/assignments
- `PUT /api/resources/catalog/[id]` - Update catalog entry
- `DELETE /api/resources/catalog/[id]` - Delete (only if no active assignments)

#### Prisma Query Pattern:
```typescript
// Complex query with availability calculation
const resources = await prisma.resource.findMany({
  include: {
    custodian: { select: { id: true, name: true, email: true, department: true } },
    items: {
      select: { id: true, status: true, assignments: { where: { status: 'ACTIVE' } } }
    },
    assignments: { where: { status: 'ACTIVE' } },
    _count: { select: { items: true, assignments: { where: { status: 'ACTIVE' } } } }
  }
});

// Frontend availability calculation
const availability = {
  total: resource.type === 'PHYSICAL' ? resource.items.length : 999,
  assigned: resource.type === 'PHYSICAL' 
    ? resource.items.filter(item => item.assignments.length > 0).length
    : resource._count.assignments,
  available: resource.type === 'PHYSICAL'
    ? resource.items.filter(item => item.status === 'AVAILABLE').length
    : 999 - resource._count.assignments
};
```

### Resource Items Management (Physical Only)

#### Frontend Flow:
```
ResourceDetailPage → ResourceItemsList → ResourceItemForm
                  ↓
             API Calls to /api/resources/items
                  ↓
             Prisma Operations
```

#### API Routes:
- `GET /api/resources/items?resourceId=xxx` - List items for resource
- `POST /api/resources/items` - Create new item
- `PUT /api/resources/items/[id]` - Update item
- `DELETE /api/resources/items/[id]` - Delete (only if not assigned)

### Assignment Management

#### Frontend Flow:
```
ResourceAssignmentForm → Approval Workflow → Assignment Creation
                      ↓
                 API Calls to /api/resources/assignments/assign
                      ↓
                 Transactional Prisma Operations
```

#### Assignment API Routes:
- `POST /api/resources/assignments/assign` - Create assignment (after approval)
- `POST /api/resources/assignments/return` - Return assignment
- `GET /api/resources/assignments?employeeId=xxx` - List employee assignments

## 📈 Inventory Calculation Logic

### Physical Resources:
```typescript
const calculatePhysicalAvailability = (resource) => {
  const total = resource.items.length;
  const assigned = resource.items.filter(item => 
    item.status === 'ASSIGNED' && item.assignments.some(a => a.status === 'ACTIVE')
  ).length;
  const available = resource.items.filter(item => item.status === 'AVAILABLE').length;
  const maintenance = resource.items.filter(item => item.status === 'MAINTENANCE').length;
  const lost = resource.items.filter(item => item.status === 'LOST').length;
  const damaged = resource.items.filter(item => item.status === 'DAMAGED').length;
  
  return { total, assigned, available, maintenance, lost, damaged };
};
```

### Software/Cloud Resources:
```typescript
const calculateSeatAvailability = (resource) => {
  const assigned = resource.assignments.filter(a => a.status === 'ACTIVE').length;
  const total = 999; // Unlimited seats
  const available = total - assigned;
  
  return { total, assigned, available };
};
```

## 🔍 UI State Management

### Resource Catalog Page State:
```typescript
interface CatalogPageState {
  resources: ResourceCatalog[];
  loading: boolean;
  filters: {
    search: string;
    type: 'PHYSICAL' | 'SOFTWARE' | 'CLOUD' | '';
    category: string;
    status: string;
  };
  pagination: PaginationData;
  showForm: boolean;
  editingResource: ResourceCatalog | null;
}
```

### Resource Detail Page State:
```typescript
interface DetailPageState {
  resource: ResourceDetail | null;
  loading: boolean;
  activeTab: 'overview' | 'items' | 'assignments' | 'audit';
  showItemForm: boolean;
  showAssignmentForm: boolean;
}
```

## 🔄 Real-time Updates

### Assignment State Changes:
1. **Assignment Created**: Item status → ASSIGNED, Assignment status → ACTIVE
2. **Assignment Returned**: Item status → AVAILABLE, Assignment status → RETURNED
3. **Item Lost**: Item status → LOST, Assignment status → LOST
4. **Item Damaged**: Item status → DAMAGED, Assignment status → DAMAGED

### UI Refresh Triggers:
- After successful assignment creation
- After successful return processing
- After item status changes
- After approval workflow completion

## 📝 Audit & Timeline Synchronization

### Audit Log Pattern:
```typescript
await prisma.auditLog.create({
  data: {
    entityType: 'RESOURCE',
    entityId: resourceId,
    changedById: userId,
    fieldChanged: 'assigned',
    newValue: JSON.stringify({ assignmentId, employeeId, itemId }),
    resourceId,
    assignmentId
  }
});
```

### Activity Timeline Pattern:
```typescript
await prisma.activityTimeline.create({
  data: {
    entityType: 'RESOURCE',
    entityId: resourceId,
    activityType: 'ASSIGNED',
    title: `${resourceName} assigned to ${employeeName}`,
    description: `Hardware item ${serialNumber} assigned`,
    performedBy: userId,
    resourceId,
    assignmentId,
    employeeId,
    metadata: { assignmentDetails, itemDetails }
  }
});
```

## 🚨 Error Handling & Edge Cases

### Inventory Consistency Checks:
1. **Double Assignment Prevention**: Check for existing active assignments
2. **Item Availability Validation**: Ensure item status is AVAILABLE before assignment
3. **Concurrent Assignment Handling**: Use database transactions with proper locking
4. **Orphaned Assignment Cleanup**: Regular cleanup jobs for inconsistent states

### Frontend Error Boundaries:
- Network error handling with retry mechanisms
- Optimistic updates with rollback on failure
- Loading states during async operations
- User-friendly error messages with actionable guidance

## 🔐 Security & Permissions

### Role-Based Access Control:
- **CEO/CTO**: Full resource management access
- **Managers**: Can assign resources to their team
- **Custodians**: Can manage their assigned resources
- **Employees**: Can view their assignments and request access

### API Security:
- Session-based authentication on all routes
- Role validation before sensitive operations
- Input sanitization and validation
- Audit logging for all state changes

This architecture ensures data consistency, provides comprehensive audit trails, and maintains clear separation of concerns between catalog management and physical inventory tracking.