const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFailedPosts() {
    const posts = await prisma.post.findMany({
        where: { status: 'SCHEDULED' },
        orderBy: { createdAt: 'desc' }
    });

    for (const p of posts) {
        console.log(`\n--- Post ID: ${p.id} ---`);
        console.log(`Length: ${p.content.length} characters`);
        console.log(`Content:\n${p.content}`);
    }
    await prisma.$disconnect();
}

checkFailedPosts();
