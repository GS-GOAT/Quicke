/*
  Warnings:

  - You are about to drop the column `modelId` on the `Message` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Message_conversationId_idx";

-- DropIndex
DROP INDEX "Message_createdAt_idx";

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "modelId";
