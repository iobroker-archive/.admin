'use strict';
const { execSync } = require('node:child_process');
const { getGithub, isRepository, prepareGhEnv } = require('./common');

// Constants
const ORG = 'iobroker-archive';

// Parse command line arguments
const args = process.argv.slice(2);
const dryrunMode = args.includes('--dryrun');

async function renameRepository(owner, oldName, newName) {
    const cmd = `gh repo rename ${newName} --repo ${owner}/${oldName} --yes`;
    console.log(`Executing: ${cmd}`);
    execSync(cmd, { env: prepareGhEnv() });
}

async function getAllRepositories(org) {
    let page = 1;
    let allRepos = [];

    console.log(`Fetching repositories from ${org}...`);

    while (true) {
        const repos = await getGithub(`https://api.github.com/orgs/${org}/repos?per_page=100&page=${page}`);
        if (repos.length === 0) break;
        allRepos = allRepos.concat(repos);
        page++;
    }

    console.log(`Total repositories found: ${allRepos.length}`);
    return allRepos;
}

function parseZombieName(repoName) {
    // Expected format: zzz-1759101576567-ioBroker.opi.-.iobroker-community-adapters
    const match = repoName.match(/^zzz-(\d+)-(.+)$/);
    if (!match) {
        return null;
    }

    return {
        timestamp: parseInt(match[1]),
        originalName: match[2]
    };
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

async function processZombieRepos(org) {
    const allRepos = await getAllRepositories(org);

    // Filter zombie repositories
    const zombieRepos = [];
    for (const repo of allRepos) {
        if (repo.name.startsWith('zzz-')) {
            const parsed = parseZombieName(repo.name);
            if (parsed) {
                zombieRepos.push({
                    fullName: repo.name,
                    timestamp: parsed.timestamp,
                    originalName: parsed.originalName
                });
            }
        }
    }

    console.log(`\nZombie repositories found: ${zombieRepos.length}\n`);

    if (zombieRepos.length === 0) {
        console.log('No zombie repositories to process.');
        return;
    }

    // Group by original name
    const groupedZombies = {};
    for (const zombie of zombieRepos) {
        if (!groupedZombies[zombie.originalName]) {
            groupedZombies[zombie.originalName] = [];
        }
        groupedZombies[zombie.originalName].push(zombie);
    }

    // Sort each group by timestamp (newest first) and keep only the newest
    const newestZombies = [];
    for (const originalName of Object.keys(groupedZombies)) {
        const zombiesForRepo = groupedZombies[originalName];
        // Sort by timestamp descending (newest first)
        zombiesForRepo.sort((a, b) => b.timestamp - a.timestamp);
        const newest = zombiesForRepo[0];
        newestZombies.push(newest);

        // Log all zombies for this original name
        console.log(`\nOriginal repository: ${originalName}`);
        for (let i = 0; i < zombiesForRepo.length; i++) {
            const zombie = zombiesForRepo[i];
            const timestampStr = formatTimestamp(zombie.timestamp);
            const marker = i === 0 ? '(newest)' : '(older)';
            console.log(`  ${timestampStr} - ${zombie.fullName} ${marker}`);
        }
    }

    console.log(`\n--- Processing ${newestZombies.length} unique zombies (newest per original repository) ---\n`);

    // Process each newest zombie
    let restoredCount = 0;
    let skippedCount = 0;

    for (const zombie of newestZombies) {
        const originalName = zombie.originalName;
        const timestampStr = formatTimestamp(zombie.timestamp);

        console.log(`\nChecking: ${zombie.fullName}`);
        console.log(`  Original name: ${originalName}`);
        console.log(`  Archived at: ${timestampStr}`);

        // Check if original repository exists
        const originalExists = await isRepository(org, originalName);

        if (originalExists) {
            console.log(`  Status: Original repository exists - SKIPPING`);
            skippedCount++;
        } else {
            console.log(`  Status: Original repository does NOT exist - RESTORING`);

            if (dryrunMode) {
                console.log(`  [DRYRUN] Would rename: ${zombie.fullName} -> ${originalName}`);
            } else {
                try {
                    await renameRepository(org, zombie.fullName, originalName);
                    console.log(`  SUCCESS: Renamed ${zombie.fullName} -> ${originalName}`);
                    restoredCount++;
                } catch (error) {
                    console.error(`  ERROR: Failed to rename ${zombie.fullName}: ${error.message}`);
                }
            }
        }
    }

    console.log('\n--- Summary ---');
    console.log(`Mode: ${dryrunMode ? 'DRYRUN (no changes made)' : 'LIVE'}`);
    console.log(`Total zombies processed: ${newestZombies.length}`);
    console.log(`Restored: ${restoredCount}`);
    console.log(`Skipped (original exists): ${skippedCount}`);
}

async function doIt() {
    console.log(`Dryrun mode: ${dryrunMode ? 'enabled' : 'disabled'}`);
    await processZombieRepos(ORG);
    return 'done';
}

console.log(`process.env.OWN_GITHUB_TOKEN = ${(process.env.OWN_GITHUB_TOKEN || '').length}`);

doIt()
    .then(result => console.log(`\n${result}`))
    .catch(e => {
        console.error(e);
        process.exit(1);
    });
