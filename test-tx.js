const { PrismaClient } = require('@prisma/client');
const { TwitterApi } = require('twitter-api-v2');

const prisma = new PrismaClient();

async function testTwitterApi() {
    console.log("Fetching latest settings from DB...");
    const settingsList = await prisma.settings.findMany({
        take: 1,
        orderBy: { updatedAt: 'desc' }
    });

    if (settingsList.length === 0) {
        console.error("No settings found in DB.");
        return;
    }

    const s = settingsList[0];
    console.log("Settings found for user ID:", s.userId);

    if (!s.xApiKey || !s.xApiSecret || !s.xAccessToken || !s.xAccessSecret) {
        console.error("Missing one or more X API keys in DB.");
        return;
    }

    console.log("X API Keys found. Initializing client...");
    const client = new TwitterApi({
        appKey: s.xApiKey,
        appSecret: s.xApiSecret,
        accessToken: s.xAccessToken,
        accessSecret: s.xAccessSecret,
    });

    try {
        console.log("Attempting to fetch user profile (v2.me())...");
        const me = await client.v2.me();
        console.log("Success! Authenticated as:", me.data.username);

        console.log("Attempting to post a test tweet...");
        const testTweet = await client.v2.tweet("This is a test tweet from API investigation. " + Date.now());
        console.log("Tweet posted successfully! ID:", testTweet.data.id);

    } catch (e) {
        console.error("Twitter API Error:");
        if (e.data) {
            console.error("Error Detail:");
            console.error(JSON.stringify(e.data, null, 2));
        } else {
            console.error(e.message);
        }
    } finally {
        await prisma.$disconnect();
    }
}

testTwitterApi();
