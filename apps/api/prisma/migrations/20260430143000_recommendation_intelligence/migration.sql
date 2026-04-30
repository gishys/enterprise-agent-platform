-- Recommendation intelligence data loop: persisted recommendations, events,
-- contextual bandit arms, user interest profiles, and offline ranking samples.

CREATE TABLE "RecommendationArm" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'default',
  "name" TEXT NOT NULL,
  "strategy" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "intent" TEXT NOT NULL,
  "promptVariant" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "priorAlpha" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "priorBeta" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecommendationArm_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Recommendation" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "userId" TEXT,
  "tenantId" TEXT NOT NULL DEFAULT 'default',
  "channel" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "intent" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "reasonCode" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "rank" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'generated',
  "modelTraceId" TEXT,
  "promptVersion" TEXT,
  "rankerVersion" TEXT NOT NULL DEFAULT 'hybrid-rules-bandit-ltr@v1',
  "banditArmId" TEXT,
  "featureSnapshot" JSONB NOT NULL DEFAULT '{}',
  "modelScore" DOUBLE PRECISION,
  "explorationBucket" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecommendationEvent" (
  "id" TEXT NOT NULL,
  "recommendationId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "userId" TEXT,
  "eventType" TEXT NOT NULL,
  "reward" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "convertedAt" TIMESTAMP(3),
  "dwellMs" INTEGER,
  "downstreamMessageId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecommendationEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserInterestProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'default',
  "department" TEXT,
  "role" TEXT NOT NULL,
  "interestVector" JSONB NOT NULL DEFAULT '[]',
  "frequentIntents" JSONB NOT NULL DEFAULT '[]',
  "recentIntents" JSONB NOT NULL DEFAULT '[]',
  "negativeIntents" JSONB NOT NULL DEFAULT '[]',
  "lastInteractionAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserInterestProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecommendationArmStat" (
  "id" TEXT NOT NULL,
  "armId" TEXT NOT NULL,
  "contextKey" TEXT NOT NULL,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "sends" INTEGER NOT NULL DEFAULT 0,
  "conversions" INTEGER NOT NULL DEFAULT 0,
  "dismisses" INTEGER NOT NULL DEFAULT 0,
  "alpha" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "beta" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecommendationArmStat_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RankingTrainingSample" (
  "id" TEXT NOT NULL,
  "recommendationId" TEXT,
  "userId" TEXT,
  "conversationId" TEXT,
  "featureSnapshot" JSONB NOT NULL DEFAULT '{}',
  "label" TEXT NOT NULL,
  "reward" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RankingTrainingSample_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RankingModelVersion" (
  "id" TEXT NOT NULL,
  "modelType" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "metrics" JSONB NOT NULL DEFAULT '{}',
  "artifactUri" TEXT,
  "status" TEXT NOT NULL DEFAULT 'shadow',
  "activatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RankingModelVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecommendationArm_tenantId_intent_strategy_key" ON "RecommendationArm"("tenantId", "intent", "strategy");
CREATE INDEX "RecommendationArm_tenantId_enabled_idx" ON "RecommendationArm"("tenantId", "enabled");
CREATE INDEX "Recommendation_conversationId_createdAt_idx" ON "Recommendation"("conversationId", "createdAt");
CREATE INDEX "Recommendation_userId_createdAt_idx" ON "Recommendation"("userId", "createdAt");
CREATE INDEX "Recommendation_tenantId_source_intent_idx" ON "Recommendation"("tenantId", "source", "intent");
CREATE INDEX "RecommendationEvent_recommendationId_createdAt_idx" ON "RecommendationEvent"("recommendationId", "createdAt");
CREATE INDEX "RecommendationEvent_conversationId_eventType_idx" ON "RecommendationEvent"("conversationId", "eventType");
CREATE UNIQUE INDEX "UserInterestProfile_userId_tenantId_key" ON "UserInterestProfile"("userId", "tenantId");
CREATE INDEX "UserInterestProfile_tenantId_department_role_idx" ON "UserInterestProfile"("tenantId", "department", "role");
CREATE UNIQUE INDEX "RecommendationArmStat_armId_contextKey_key" ON "RecommendationArmStat"("armId", "contextKey");
CREATE INDEX "RecommendationArmStat_contextKey_idx" ON "RecommendationArmStat"("contextKey");
CREATE INDEX "RankingTrainingSample_recommendationId_idx" ON "RankingTrainingSample"("recommendationId");
CREATE INDEX "RankingTrainingSample_createdAt_idx" ON "RankingTrainingSample"("createdAt");
CREATE UNIQUE INDEX "RankingModelVersion_modelType_version_key" ON "RankingModelVersion"("modelType", "version");
CREATE INDEX "RankingModelVersion_status_idx" ON "RankingModelVersion"("status");

ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_banditArmId_fkey" FOREIGN KEY ("banditArmId") REFERENCES "RecommendationArm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecommendationEvent" ADD CONSTRAINT "RecommendationEvent_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserInterestProfile" ADD CONSTRAINT "UserInterestProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecommendationArmStat" ADD CONSTRAINT "RecommendationArmStat_armId_fkey" FOREIGN KEY ("armId") REFERENCES "RecommendationArm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RankingTrainingSample" ADD CONSTRAINT "RankingTrainingSample_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
