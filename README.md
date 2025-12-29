# Internal Portal - Enterprise Resource Management System

A comprehensive Next.js application for managing internal company operations including employee management, resource allocation, access control, policy management, and approval workflows with complete audit logging and timeline tracking.

1. **Environment setup**:
   ```bash

   DATABASE_URL="postgresql://username:password@localhost:5432/internal_portal"
   JWT_SECRET="your-super-secret-jwt-key"
   ```
2. **Initialize with sample data**:
   ```bash
   # Option 1: Single CEO user with unallocated resources
   npm run setup-single-user
   
   # Option 2: Bootstrap with CEO and sample data
   npm run bootstrap
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Access the application**:
   - Open [http://localhost:3000](http://localhost:3000)
   - Login with: `ceo@unisouk.com` / `admin123`

## 📋 Getting Started - Step by Step Workflow

### 🎯 **Phase 1: Initial Setup & Seeding**

After completing the installation steps above, you'll have a clean database with one CEO user and comprehensive resource inventory.

**What the setup script creates:**
- **1 CEO User**: John Smith (`ceo@unisouk.com` / `admin123`)
- **19 Resource Types**: Physical, Software, and Cloud resources
- **429 Total Resource Units**: All unallocated and ready for assignment
- **Complete Inventory**: Laptops, software licenses, cloud services, etc.
