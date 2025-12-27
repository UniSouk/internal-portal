#!/usr/bin/env node

/**
 * Setup Script: Single User + Unallocated Resources
 * 
 * This script creates:
 * 1. One CEO user (admin privileges)
 * 2. Various resources (Physical, Software, Cloud) 
 * 3. All resources remain unallocated (available for assignment)
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function setupSingleUserWithResources() {
  console.log('🚀 Setting up single user with unallocated resources...\n');

  try {
    // Clear existing data in proper order (respecting foreign key constraints)
    console.log('🧹 Cleaning existing data...');
    await prisma.activityTimeline.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.approvalWorkflow.deleteMany({});
    await prisma.access.deleteMany({});
    await prisma.resourceAssignment.deleteMany({});
    await prisma.resource.deleteMany({});
    await prisma.policy.deleteMany({});
    await prisma.document.deleteMany({});
    await prisma.employee.deleteMany({});
    console.log('   ✅ Existing data cleared\n');

    // Create the single CEO user
    console.log('👤 Creating CEO user...');
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    const ceoUser = await prisma.employee.create({
      data: {
        name: 'Nihil Parmar',
        email: 'nihil@unisouk.com',
        password: hashedPassword,
        role: 'CEO',
        department: 'Executive',
        status: 'ACTIVE',
        joiningDate: new Date(),
        phone: '+91 7905049280',
        address: '123 Business Ave, Corporate City, CC 12345'
      }
    });
    
    console.log(`   ✅ CEO created: ${ceoUser.name} (${ceoUser.email})`);
    console.log(`   🔑 Password: admin123\n`);

    // Create Physical Resources
    console.log('💻 Creating Physical Resources...');
    const physicalResources = [
      {
        name: 'MacBook Pro 16-inch M3',
        category: 'Laptop',
        description: 'High-performance laptop for development work',
        brand: 'Apple',
        modelNumber: 'MBP16-M3-2024',
        serialNumber: 'MBP001',
        totalQuantity: 5,
        value: 2999.99,
        location: 'IT Storage Room A',
        specifications: JSON.stringify({
          processor: 'Apple M3 Pro',
          memory: '32GB',
          storage: '1TB SSD',
          display: '16-inch Liquid Retina XDR'
        })
      },
      {
        name: 'Dell XPS 13',
        category: 'Laptop',
        description: 'Lightweight business laptop',
        brand: 'Dell',
        modelNumber: 'XPS13-2024',
        serialNumber: 'DELL001',
        totalQuantity: 8,
        value: 1299.99,
        location: 'IT Storage Room A'
      },
      {
        name: 'LG UltraWide Monitor 34"',
        category: 'Monitor',
        description: 'Ultra-wide monitor for productivity',
        brand: 'LG',
        modelNumber: '34WN80C-B',
        serialNumber: 'LG001',
        totalQuantity: 12,
        value: 399.99,
        location: 'IT Storage Room B'
      },
      {
        name: 'iPhone 15 Pro',
        category: 'Mobile Device',
        description: 'Company mobile phone',
        brand: 'Apple',
        modelNumber: 'iPhone15Pro',
        serialNumber: 'IP001',
        totalQuantity: 10,
        value: 999.99,
        location: 'IT Storage Room C'
      },
      {
        name: 'iPad Pro 12.9"',
        category: 'Tablet',
        description: 'Tablet for presentations and mobile work',
        brand: 'Apple',
        modelNumber: 'iPadPro12.9',
        serialNumber: 'IPAD001',
        totalQuantity: 6,
        value: 1099.99,
        location: 'IT Storage Room C'
      },
      {
        name: 'Logitech MX Master 3S',
        category: 'Peripherals',
        description: 'Wireless productivity mouse',
        brand: 'Logitech',
        modelNumber: 'MX-Master-3S',
        serialNumber: 'LOG001',
        totalQuantity: 20,
        value: 99.99,
        location: 'IT Storage Room D'
      },
      {
        name: 'Herman Miller Aeron Chair',
        category: 'Furniture',
        description: 'Ergonomic office chair',
        brand: 'Herman Miller',
        modelNumber: 'Aeron-Size-B',
        serialNumber: 'HM001',
        totalQuantity: 15,
        value: 1395.00,
        location: 'Furniture Warehouse'
      }
    ];

    for (const resource of physicalResources) {
      await prisma.resource.create({
        data: {
          ...resource,
          type: 'PHYSICAL',
          owner: 'Unisouk',
          custodianId: ceoUser.id,
          status: 'ACTIVE',
          purchaseDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // Random date within last year
          warrantyExpiry: new Date(Date.now() + (2 * 365 * 24 * 60 * 60 * 1000)) // 2 years from now
        }
      });
    }
    console.log(`   ✅ Created ${physicalResources.length} physical resources\n`);

    // Create Software Resources
    console.log('💾 Creating Software Resources...');
    const softwareResources = [
      {
        name: 'Microsoft Office 365 Business Premium',
        category: 'Productivity Suite',
        description: 'Complete office productivity suite',
        provider: 'Microsoft',
        softwareVersion: '2024',
        totalQuantity: 50,
        monthlyRate: 22.00,
        annualRate: 264.00,
        serviceLevel: 'Business Premium',
        defaultPermission: 'WRITE'
      },
      {
        name: 'Adobe Creative Cloud',
        category: 'Design Software',
        description: 'Creative design and video editing suite',
        provider: 'Adobe',
        softwareVersion: '2024',
        totalQuantity: 10,
        monthlyRate: 52.99,
        annualRate: 635.88,
        serviceLevel: 'All Apps',
        defaultPermission: 'EDIT'
      },
      {
        name: 'JetBrains IntelliJ IDEA Ultimate',
        category: 'Development IDE',
        description: 'Professional Java and Kotlin IDE',
        provider: 'JetBrains',
        softwareVersion: '2024.3',
        totalQuantity: 15,
        annualRate: 649.00,
        serviceLevel: 'Ultimate',
        defaultPermission: 'EDIT'
      },
      {
        name: 'Slack Business+',
        category: 'Communication',
        description: 'Team communication and collaboration',
        provider: 'Slack',
        totalQuantity: 100,
        monthlyRate: 12.50,
        annualRate: 150.00,
        serviceLevel: 'Business+',
        defaultPermission: 'WRITE'
      },
      {
        name: 'Figma Professional',
        category: 'Design Tool',
        description: 'Collaborative design platform',
        provider: 'Figma',
        totalQuantity: 8,
        monthlyRate: 15.00,
        annualRate: 180.00,
        serviceLevel: 'Professional',
        defaultPermission: 'EDIT'
      },
      {
        name: 'Zoom Pro',
        category: 'Video Conferencing',
        description: 'Professional video conferencing solution',
        provider: 'Zoom',
        totalQuantity: 25,
        monthlyRate: 14.99,
        annualRate: 179.88,
        serviceLevel: 'Pro',
        defaultPermission: 'WRITE'
      }
    ];

    for (const resource of softwareResources) {
      await prisma.resource.create({
        data: {
          ...resource,
          type: 'SOFTWARE',
          owner: 'Unisouk',
          custodianId: ceoUser.id,
          status: 'ACTIVE',
          licenseExpiry: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)) // 1 year from now
        }
      });
    }
    console.log(`   ✅ Created ${softwareResources.length} software resources\n`);

    // Create Cloud Resources
    console.log('☁️ Creating Cloud Resources...');
    const cloudResources = [
      {
        name: 'AWS EC2 Production Environment',
        category: 'Compute',
        description: 'Production server instances on AWS',
        provider: 'Amazon Web Services',
        serviceLevel: 't3.large',
        totalQuantity: 5,
        monthlyRate: 67.07,
        annualRate: 804.84,
        defaultPermission: 'READ'
      },
      {
        name: 'AWS RDS PostgreSQL',
        category: 'Database',
        description: 'Managed PostgreSQL database service',
        provider: 'Amazon Web Services',
        serviceLevel: 'db.t3.medium',
        totalQuantity: 3,
        monthlyRate: 58.40,
        annualRate: 700.80,
        defaultPermission: 'READ'
      },
      {
        name: 'Google Workspace Business Standard',
        category: 'Productivity Cloud',
        description: 'Cloud-based productivity and collaboration suite',
        provider: 'Google',
        serviceLevel: 'Business Standard',
        totalQuantity: 75,
        monthlyRate: 12.00,
        annualRate: 144.00,
        defaultPermission: 'WRITE'
      },
      {
        name: 'Microsoft Azure DevOps',
        category: 'Development Platform',
        description: 'Cloud development and CI/CD platform',
        provider: 'Microsoft',
        serviceLevel: 'Basic + Test Plans',
        totalQuantity: 20,
        monthlyRate: 6.00,
        annualRate: 72.00,
        defaultPermission: 'WRITE'
      },
      {
        name: 'Salesforce Professional',
        category: 'CRM',
        description: 'Customer relationship management platform',
        provider: 'Salesforce',
        serviceLevel: 'Professional',
        totalQuantity: 12,
        monthlyRate: 80.00,
        annualRate: 960.00,
        defaultPermission: 'WRITE'
      },
      {
        name: 'GitHub Enterprise Cloud',
        category: 'Code Repository',
        description: 'Enterprise code hosting and collaboration',
        provider: 'GitHub',
        serviceLevel: 'Enterprise Cloud',
        totalQuantity: 30,
        monthlyRate: 21.00,
        annualRate: 252.00,
        defaultPermission: 'WRITE'
      }
    ];

    for (const resource of cloudResources) {
      await prisma.resource.create({
        data: {
          ...resource,
          type: 'CLOUD',
          owner: 'Unisouk',
          custodianId: ceoUser.id,
          status: 'ACTIVE',
          subscriptionExpiry: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)) // 1 year from now
        }
      });
    }
    console.log(`   ✅ Created ${cloudResources.length} cloud resources\n`);

    // Summary
    const totalResources = await prisma.resource.count();
    const totalQuantity = await prisma.resource.aggregate({
      _sum: { totalQuantity: true }
    });

    console.log('🎉 Setup Complete!\n');
    console.log('📊 Summary:');
    console.log(`   👤 Users created: 1`);
    console.log(`   📦 Resources created: ${totalResources}`);
    console.log(`   🔢 Total resource units: ${totalQuantity._sum.totalQuantity}`);
    console.log(`   📋 Resource breakdown:`);
    console.log(`      • Physical: ${physicalResources.length} types`);
    console.log(`      • Software: ${softwareResources.length} types`);
    console.log(`      • Cloud: ${cloudResources.length} types`);
    console.log(`   ✅ All resources are unallocated and available for assignment\n`);

    console.log('🔐 Login Credentials:');
    console.log(`   Email: ${ceoUser.email}`);
    console.log(`   Password: admin123`);
    console.log(`   Role: CEO (Full Access)\n`);

    console.log('🚀 Next Steps:');
    console.log('   1. Start the application: npm run dev');
    console.log('   2. Login with the credentials above');
    console.log('   3. Navigate to Resources page to see all available resources');
    console.log('   4. Use the assignment modal to allocate resources to employees');
    console.log('   5. Add more employees through the Employees page if needed');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
setupSingleUserWithResources()
  .then(() => {
    console.log('\n✨ Setup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Setup failed:', error);
    process.exit(1);
  });