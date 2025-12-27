/*
  Warnings:

  - You are about to drop the column `assignedDate` on the `Resource` table. All the data in the column will be lost.
  - You are about to drop the column `assignedToId` on the `Resource` table. All the data in the column will be lost.
  - You are about to drop the column `assignedToIds` on the `Resource` table. All the data in the column will be lost.
  - You are about to drop the column `expiryDate` on the `Resource` table. All the data in the column will be lost.
  - You are about to drop the column `installedSoftware` on the `Resource` table. All the data in the column will be lost.
  - You are about to drop the column `lastUsed` on the `Resource` table. All the data in the column will be lost.
  - You are about to drop the column `ownerId` on the `Resource` table. All the data in the column will be lost.
  - You are about to drop the column `permissionLevel` on the `Resource` table. All the data in the column will be lost.
  - You are about to drop the column `usageMetrics` on the `Resource` table. All the data in the column will be lost.
  - The `status` column on the `Resource` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `custodianId` to the `Resource` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('ACTIVE', 'RETURNED', 'LOST', 'DAMAGED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'RETURNED', 'LOST', 'DAMAGED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'ASSIGNED';
ALTER TYPE "ActivityType" ADD VALUE 'ONBOARDING_COMPLETED';
ALTER TYPE "ActivityType" ADD VALUE 'ONBOARDING_FAILED';

-- DropForeignKey
ALTER TABLE "Resource" DROP CONSTRAINT "Resource_assignedToId_fkey";

-- DropForeignKey
ALTER TABLE "Resource" DROP CONSTRAINT "Resource_ownerId_fkey";

-- AlterTable
ALTER TABLE "ActivityTimeline" ADD COLUMN     "assignmentId" TEXT;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "assignmentId" TEXT,
ADD COLUMN     "resourceId" TEXT;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Resource" DROP COLUMN "assignedDate",
DROP COLUMN "assignedToId",
DROP COLUMN "assignedToIds",
DROP COLUMN "expiryDate",
DROP COLUMN "installedSoftware",
DROP COLUMN "lastUsed",
DROP COLUMN "ownerId",
DROP COLUMN "permissionLevel",
DROP COLUMN "usageMetrics",
ADD COLUMN     "custodianId" TEXT NOT NULL,
ADD COLUMN     "owner" TEXT NOT NULL DEFAULT 'Unisouk',
ADD COLUMN     "totalQuantity" INTEGER NOT NULL DEFAULT 1,
DROP COLUMN "status",
ADD COLUMN     "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "ResourceAssignment" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "quantityAssigned" INTEGER NOT NULL DEFAULT 1,
    "assignedBy" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "returnReason" TEXT,
    "lossReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResourceAssignment_resourceId_employeeId_status_key" ON "ResourceAssignment"("resourceId", "employeeId", "status");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceAssignment" ADD CONSTRAINT "ResourceAssignment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceAssignment" ADD CONSTRAINT "ResourceAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceAssignment" ADD CONSTRAINT "ResourceAssignment_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ResourceAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityTimeline" ADD CONSTRAINT "ActivityTimeline_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ResourceAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
