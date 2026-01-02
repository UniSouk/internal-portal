-- CreateEnum
CREATE TYPE "AllocationType" AS ENUM ('EXCLUSIVE', 'SHARED');

-- AlterTable
ALTER TABLE "Resource" ADD COLUMN     "allocationType" "AllocationType" NOT NULL DEFAULT 'EXCLUSIVE';
