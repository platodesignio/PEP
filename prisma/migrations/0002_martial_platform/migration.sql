-- Martial Neurocontrol Training Platform
-- Add COACH role to existing Role enum (PostgreSQL non-transactional)
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'COACH';

-- Place (道場)
CREATE TABLE "Place" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "lat"       DOUBLE PRECISION NOT NULL,
    "lng"       DOUBLE PRECISION NOT NULL,
    "radiusM"   DOUBLE PRECISION NOT NULL DEFAULT 50,
    "active"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- Routine (稽古メニュー)
CREATE TABLE "Routine" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "descJson"   TEXT NOT NULL DEFAULT '{}',
    "targetSec"  INTEGER NOT NULL DEFAULT 300,
    "phasesJson" TEXT NOT NULL DEFAULT '[]',
    "active"     BOOLEAN NOT NULL DEFAULT true,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

-- Execution (稽古セッション)
CREATE TABLE "Execution" (
    "id"            TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "placeId"       TEXT,
    "routineId"     TEXT,
    "startedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt"       TIMESTAMP(3),
    "tciScore"      DOUBLE PRECISION,
    "metricsJson"   TEXT NOT NULL DEFAULT '{}',
    "coachNoteJson" TEXT NOT NULL DEFAULT '{}',
    "inRange"       BOOLEAN NOT NULL DEFAULT true,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id")
);

-- MotionSample (加速度センサー)
CREATE TABLE "MotionSample" (
    "id"          TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "t"           DOUBLE PRECISION NOT NULL,
    "ax"          DOUBLE PRECISION NOT NULL,
    "ay"          DOUBLE PRECISION NOT NULL,
    "az"          DOUBLE PRECISION NOT NULL,
    "gx"          DOUBLE PRECISION,
    "gy"          DOUBLE PRECISION,
    "gz"          DOUBLE PRECISION,
    "tci"         DOUBLE PRECISION,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MotionSample_pkey" PRIMARY KEY ("id")
);

-- HRVSample (Apple Watch HRV)
CREATE TABLE "HRVSample" (
    "id"          TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "t"           DOUBLE PRECISION NOT NULL,
    "rrMs"        DOUBLE PRECISION NOT NULL,
    "sdnn"        DOUBLE PRECISION,
    "rmssd"       DOUBLE PRECISION,
    "lfhf"        DOUBLE PRECISION,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HRVSample_pkey" PRIMARY KEY ("id")
);

-- RespirationSample (呼吸)
CREATE TABLE "RespirationSample" (
    "id"          TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "t"           DOUBLE PRECISION NOT NULL,
    "ratePerMin"  DOUBLE PRECISION NOT NULL,
    "depthScore"  DOUBLE PRECISION,
    "regularity"  DOUBLE PRECISION,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RespirationSample_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "Place_userId_idx"              ON "Place"("userId");
CREATE INDEX "Routine_userId_idx"            ON "Routine"("userId");
CREATE INDEX "Execution_userId_idx"          ON "Execution"("userId");
CREATE INDEX "Execution_placeId_idx"         ON "Execution"("placeId");
CREATE INDEX "Execution_routineId_idx"       ON "Execution"("routineId");
CREATE INDEX "Execution_startedAt_idx"       ON "Execution"("startedAt");
CREATE INDEX "MotionSample_executionId_t_idx" ON "MotionSample"("executionId", "t");
CREATE INDEX "HRVSample_executionId_t_idx"   ON "HRVSample"("executionId", "t");
CREATE INDEX "RespirationSample_executionId_t_idx" ON "RespirationSample"("executionId", "t");

-- Foreign keys
ALTER TABLE "Place"      ADD CONSTRAINT "Place_userId_fkey"
    FOREIGN KEY ("userId")    REFERENCES "User"("id")      ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Routine"    ADD CONSTRAINT "Routine_userId_fkey"
    FOREIGN KEY ("userId")    REFERENCES "User"("id")      ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Execution"  ADD CONSTRAINT "Execution_userId_fkey"
    FOREIGN KEY ("userId")    REFERENCES "User"("id")      ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Execution"  ADD CONSTRAINT "Execution_placeId_fkey"
    FOREIGN KEY ("placeId")   REFERENCES "Place"("id")     ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Execution"  ADD CONSTRAINT "Execution_routineId_fkey"
    FOREIGN KEY ("routineId") REFERENCES "Routine"("id")   ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MotionSample"      ADD CONSTRAINT "MotionSample_executionId_fkey"
    FOREIGN KEY ("executionId") REFERENCES "Execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HRVSample"         ADD CONSTRAINT "HRVSample_executionId_fkey"
    FOREIGN KEY ("executionId") REFERENCES "Execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RespirationSample" ADD CONSTRAINT "RespirationSample_executionId_fkey"
    FOREIGN KEY ("executionId") REFERENCES "Execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
