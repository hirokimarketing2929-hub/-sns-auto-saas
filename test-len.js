const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    console.log("Checking the failed post length:");
    const post = await prisma.post.findUnique({ where: { id: "cmmb80wzm00019k8bkq8v5i7j" } });
    if (post) {
        console.log("Length:", post.content.length);
        console.log("Snippet:", post.content.substring(0, 50));
    } else {
        console.log("Post not found.");
    }
}
run();
