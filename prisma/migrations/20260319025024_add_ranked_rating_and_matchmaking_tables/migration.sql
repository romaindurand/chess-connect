-- CreateTable
CREATE TABLE "PlayerRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1200,
    "ratingDeviation" REAL NOT NULL DEFAULT 350,
    "volatility" REAL NOT NULL DEFAULT 0.06,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlayerRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RankedQueueEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "enteredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "searchRange" INTEGER NOT NULL DEFAULT 75,
    CONSTRAINT "RankedQueueEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RankedMatchProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "gameId" TEXT
);

-- CreateTable
CREATE TABLE "RankedMatchParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ratingSnapshot" INTEGER NOT NULL,
    "ratingDeviation" REAL NOT NULL,
    "joinedQueueAt" DATETIME NOT NULL,
    "acceptedAt" DATETIME,
    "rejectedAt" DATETIME,
    "gameToken" TEXT,
    CONSTRAINT "RankedMatchParticipant_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "RankedMatchProposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RankedMatchParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RankedResult" (
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
    CONSTRAINT "RankedResult_winnerUserId_fkey" FOREIGN KEY ("winnerUserId") REFERENCES "UserAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RankedResult_loserUserId_fkey" FOREIGN KEY ("loserUserId") REFERENCES "UserAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "rankedWins" INTEGER NOT NULL DEFAULT 0,
    "rankedLosses" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_UserAccount" ("createdAt", "id", "updatedAt", "username") SELECT "createdAt", "id", "updatedAt", "username" FROM "UserAccount";
DROP TABLE "UserAccount";
ALTER TABLE "new_UserAccount" RENAME TO "UserAccount";
CREATE UNIQUE INDEX "UserAccount_username_key" ON "UserAccount"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PlayerRating_userId_key" ON "PlayerRating"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RankedQueueEntry_userId_key" ON "RankedQueueEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RankedMatchParticipant_proposalId_userId_key" ON "RankedMatchParticipant"("proposalId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RankedResult_gameId_key" ON "RankedResult"("gameId");
