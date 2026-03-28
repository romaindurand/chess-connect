-- CreateTable
CREATE TABLE "RapidPlayerRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1200,
    "ratingDeviation" REAL NOT NULL DEFAULT 350,
    "volatility" REAL NOT NULL DEFAULT 0.06,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RapidPlayerRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RapidQueueEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "enteredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "searchRange" INTEGER NOT NULL DEFAULT 75,
    CONSTRAINT "RapidQueueEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RapidMatchProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "gameId" TEXT
);

-- CreateTable
CREATE TABLE "RapidMatchParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ratingSnapshot" INTEGER NOT NULL,
    "ratingDeviation" REAL NOT NULL,
    "joinedQueueAt" DATETIME NOT NULL,
    "acceptedAt" DATETIME,
    "rejectedAt" DATETIME,
    "gameToken" TEXT,
    CONSTRAINT "RapidMatchParticipant_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "RapidMatchProposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RapidMatchParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RapidResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "winnerUserId" TEXT NOT NULL,
    "loserUserId" TEXT NOT NULL,
    "winnerBefore" INTEGER NOT NULL,
    "winnerAfter" INTEGER NOT NULL,
    "loserBefore" INTEGER NOT NULL,
    "loserAfter" INTEGER NOT NULL,
    "winnerDelta" INTEGER NOT NULL,
    "loserDelta" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RapidResult_winnerUserId_fkey" FOREIGN KEY ("winnerUserId") REFERENCES "UserAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RapidResult_loserUserId_fkey" FOREIGN KEY ("loserUserId") REFERENCES "UserAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RapidPlayerRating_userId_key" ON "RapidPlayerRating"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RapidQueueEntry_userId_key" ON "RapidQueueEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RapidMatchParticipant_proposalId_userId_key" ON "RapidMatchParticipant"("proposalId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RapidResult_gameId_key" ON "RapidResult"("gameId");
