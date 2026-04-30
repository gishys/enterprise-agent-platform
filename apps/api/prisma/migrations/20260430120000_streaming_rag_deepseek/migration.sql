CREATE TABLE IF NOT EXISTS "KnowledgeChunk" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "knowledgeId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "embedding" JSONB,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "title" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "version" INTEGER NOT NULL,
  "sensitivity" "SensitivityLevel" NOT NULL,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "tokenCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeChunk_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "Knowledge"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "KnowledgeChunk_knowledgeId_idx" ON "KnowledgeChunk"("knowledgeId");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_sensitivity_idx" ON "KnowledgeChunk"("sensitivity");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_version_idx" ON "KnowledgeChunk"("version");
