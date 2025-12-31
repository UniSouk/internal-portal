const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function setupSingleUserWithResources() {
  console.log('Setting up single user with unallocated resources...\n');

  try {
    await prisma.activityTimeline.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.approvalWorkflow.deleteMany({});
    await prisma.access.deleteMany({});
    await prisma.resourceAssignment.deleteMany({});
    await prisma.resource.deleteMany({});
    await prisma.policy.deleteMany({});
    await prisma.document.deleteMany({});
    await prisma.employee.deleteMany({});
    console.log('Existing data cleared\n');

    // Create the single CEO user
    console.log('Creating CEO user...');
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

  } catch (error) {
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
setupSingleUserWithResources()
  .then(() => {
    console.log('Setup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Setup failed:', error);
    process.exit(1);
  });